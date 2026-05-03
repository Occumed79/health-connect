from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from email.message import EmailMessage
import os
import uuid
import json
import ssl
import smtplib
import urllib.parse
import urllib.request

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "healthconnect")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

outreach_router = APIRouter(prefix="/outreach", tags=["Outreach Automation"])

SAFE_AUTOMATION_RULES = [
    "No PHI or applicant-specific medical details may be sent through autonomous outreach.",
    "The agent may only ask about services, pricing, payment terms, scheduling, turnaround time, and form-completion willingness.",
    "The agent must identify itself as an assistant helping Occu-Med coordinate provider availability.",
    "The agent must not discuss employment clearance, fitness determinations, medical advice, or legal conclusions.",
    "Any complex, unclear, angry, legal, medical, or applicant-specific response must be escalated for human review.",
]

class SendRequest(BaseModel):
    thread_id: Optional[str] = None
    agent_mode: str = "email-human"
    channel: str = "email"
    to: str
    subject: str = "Occu-Med provider availability inquiry"
    body: str
    human_approved: bool = False
    clinic_name: str = ""

class QueueRequest(BaseModel):
    thread_id: Optional[str] = None
    agent_mode: str
    channel: str
    to: str
    subject: str = "Occu-Med provider availability inquiry"
    body: str
    clinic_name: str = ""
    status: str = "queued"
    requires_human_approval: bool = True

class InboundMessage(BaseModel):
    thread_id: Optional[str] = None
    channel: str = "email"
    from_address: str = ""
    body: str
    clinic_name: str = ""

class ApprovalRequest(BaseModel):
    approved: bool = True
    approved_by: str = "Alex"

class AutomationSettings(BaseModel):
    email_autonomous_enabled: bool = False
    email_human_enabled: bool = True
    whatsapp_autonomous_enabled: bool = False
    daily_send_limit: int = 25
    require_human_approval_for_first_contact: bool = True
    require_human_approval_for_followup: bool = True
    stop_words: List[str] = Field(default_factory=lambda: ["stop", "unsubscribe", "remove", "do not contact"])


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean_doc(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in ["1", "true", "yes", "on"]


def outbound_config_status():
    return {
        "smtp_configured": bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD")),
        "twilio_whatsapp_configured": bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN") and os.environ.get("TWILIO_WHATSAPP_FROM")),
        "meta_whatsapp_configured": bool(os.environ.get("WHATSAPP_ACCESS_TOKEN") and os.environ.get("WHATSAPP_PHONE_NUMBER_ID")),
        "email_from": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
        "whatsapp_from": os.environ.get("TWILIO_WHATSAPP_FROM") or os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        "safe_automation_rules": SAFE_AUTOMATION_RULES,
    }


def is_autonomous(agent_mode: str) -> bool:
    return agent_mode in ["email-autonomous", "whatsapp-autonomous"]


def channel_enabled(channel: str, agent_mode: str) -> bool:
    if channel == "email" and agent_mode == "email-autonomous":
        return env_bool("EMAIL_AUTONOMOUS_ENABLED", False)
    if channel == "whatsapp" and agent_mode == "whatsapp-autonomous":
        return env_bool("WHATSAPP_AUTONOMOUS_ENABLED", False)
    if channel == "email" and agent_mode == "email-human":
        return True
    return False


def check_message_safety(req: SendRequest):
    lowered = req.body.lower()
    risky_terms = ["ssn", "social security", "diagnosis", "diagnosed", "a1c", "blood pressure", "medication", "clearance", "clear them", "fit for duty", "disqualify", "qualified"]
    hits = [term for term in risky_terms if term in lowered]
    if hits:
        raise HTTPException(status_code=400, detail=f"Message blocked by safety guardrail. Remove applicant/medical/determination content: {', '.join(hits[:5])}")
    if is_autonomous(req.agent_mode) and not channel_enabled(req.channel, req.agent_mode):
        raise HTTPException(status_code=400, detail=f"{req.agent_mode} is disabled. Enable it with environment variables after testing human-approval mode.")
    if req.agent_mode == "email-human" and not req.human_approved:
        raise HTTPException(status_code=400, detail="Human approval is required before sending this email.")
    if is_autonomous(req.agent_mode) and env_bool("REQUIRE_HUMAN_APPROVAL_FOR_AUTONOMOUS", True) and not req.human_approved:
        raise HTTPException(status_code=400, detail="Autonomous send is configured to require human approval. Set human_approved=true or change the env setting after testing.")


def send_email_smtp(to_address: str, subject: str, body: str):
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    from_address = os.environ.get("SMTP_FROM", user or "")
    if not all([host, user, password, from_address]):
        raise HTTPException(status_code=400, detail="SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.")
    msg = EmailMessage()
    msg["From"] = from_address
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(body)
    context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls(context=context)
        server.login(user, password)
        server.send_message(msg)
    return {"provider": "smtp", "to": to_address, "subject": subject}


def send_twilio_whatsapp(to_number: str, body: str):
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM")
    if not all([sid, token, from_number]):
        raise HTTPException(status_code=400, detail="Twilio WhatsApp is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM.")
    to_number = to_number if to_number.startswith("whatsapp:") else f"whatsapp:{to_number}"
    from_number = from_number if from_number.startswith("whatsapp:") else f"whatsapp:{from_number}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    payload = urllib.parse.urlencode({"From": from_number, "To": to_number, "Body": body}).encode("utf-8")
    request = urllib.request.Request(url, data=payload)
    credentials = (f"{sid}:{token}").encode("utf-8")
    import base64
    request.add_header("Authorization", "Basic " + base64.b64encode(credentials).decode("ascii"))
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return {"provider": "twilio_whatsapp", "response": json.loads(raw)}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=400, detail=f"Twilio send failed: {detail}")


async def log_message(thread_id: Optional[str], channel: str, direction: str, body: str, status: str, extra: Optional[Dict[str, Any]] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id or "",
        "channel": channel,
        "direction": direction,
        "body": body,
        "status": status,
        "created_at": now_iso(),
        **(extra or {}),
    }
    await db.outreach_messages.insert_one(doc)
    if thread_id:
        await db.outreach_threads.update_one({"id": thread_id}, {"$set": {"status": status, "updated_at": now_iso(), "latest_summary": body[:500]}})
    return clean_doc(doc)


@outreach_router.get("/config/status")
async def config_status():
    return outbound_config_status()


@outreach_router.get("/automation/settings")
async def get_automation_settings():
    doc = await db.outreach_settings.find_one({"id": "default"}, {"_id": 0})
    if doc:
        return doc
    defaults = AutomationSettings().model_dump()
    defaults["id"] = "default"
    defaults["created_at"] = now_iso()
    defaults["updated_at"] = now_iso()
    return defaults


@outreach_router.put("/automation/settings")
async def update_automation_settings(settings: AutomationSettings):
    doc = settings.model_dump()
    doc["id"] = "default"
    doc["updated_at"] = now_iso()
    await db.outreach_settings.update_one({"id": "default"}, {"$set": doc, "$setOnInsert": {"created_at": now_iso()}}, upsert=True)
    return clean_doc(await db.outreach_settings.find_one({"id": "default"}, {"_id": 0}))


@outreach_router.get("/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    docs = await db.outreach_messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [clean_doc(d) for d in docs]


@outreach_router.post("/queue")
async def queue_outreach(req: QueueRequest):
    doc = req.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.outreach_queue.insert_one(doc)
    await log_message(req.thread_id, req.channel, "outbound", req.body, "queued", {"queue_id": doc["id"], "to": req.to, "subject": req.subject})
    return clean_doc(doc)


@outreach_router.get("/queue")
async def list_queue(status: Optional[str] = None, limit: int = Query(100, ge=1, le=1000)):
    q = {}
    if status:
        q["status"] = status
    docs = await db.outreach_queue.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [clean_doc(d) for d in docs]


@outreach_router.post("/queue/{queue_id}/approve")
async def approve_queue_item(queue_id: str, req: ApprovalRequest):
    status = "approved" if req.approved else "rejected"
    res = await db.outreach_queue.update_one({"id": queue_id}, {"$set": {"status": status, "approved_by": req.approved_by, "approved_at": now_iso(), "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return clean_doc(await db.outreach_queue.find_one({"id": queue_id}, {"_id": 0}))


@outreach_router.post("/send")
async def send_outreach(req: SendRequest):
    check_message_safety(req)
    if req.channel == "email":
        provider_response = send_email_smtp(req.to, req.subject, req.body)
    elif req.channel == "whatsapp":
        provider_response = send_twilio_whatsapp(req.to, req.body)
    else:
        raise HTTPException(status_code=400, detail="Unsupported channel. Use email or whatsapp.")
    message = await log_message(req.thread_id, req.channel, "outbound", req.body, "sent", {"to": req.to, "subject": req.subject, "provider_response": provider_response})
    return {"sent": True, "message": message, "provider_response": provider_response}


@outreach_router.post("/queue/{queue_id}/send")
async def send_queue_item(queue_id: str):
    item = await db.outreach_queue.find_one({"id": queue_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if item.get("requires_human_approval") and item.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Queue item requires approval before sending.")
    req = SendRequest(
        thread_id=item.get("thread_id"),
        agent_mode=item.get("agent_mode", "email-human"),
        channel=item.get("channel", "email"),
        to=item.get("to", ""),
        subject=item.get("subject", "Occu-Med provider availability inquiry"),
        body=item.get("body", ""),
        human_approved=True,
        clinic_name=item.get("clinic_name", ""),
    )
    result = await send_outreach(req)
    await db.outreach_queue.update_one({"id": queue_id}, {"$set": {"status": "sent", "sent_at": now_iso(), "updated_at": now_iso()}})
    return result


@outreach_router.post("/inbound")
async def ingest_inbound_message(req: InboundMessage):
    message = await log_message(req.thread_id, req.channel, "inbound", req.body, "received", {"from": req.from_address, "clinic_name": req.clinic_name})
    return {"received": True, "message": message}


@outreach_router.post("/automation/run")
async def run_automation_once(limit: int = Query(10, ge=1, le=50)):
    # Controlled single-pass runner. It only sends already-approved queue items.
    docs = await db.outreach_queue.find({"status": "approved"}, {"_id": 0}).sort("created_at", 1).to_list(limit)
    results = []
    for item in docs:
        try:
            result = await send_queue_item(item["id"])
            results.append({"queue_id": item["id"], "sent": True, "result": result})
        except Exception as e:
            await db.outreach_queue.update_one({"id": item["id"]}, {"$set": {"status": "failed", "error": str(e), "updated_at": now_iso()}})
            results.append({"queue_id": item["id"], "sent": False, "error": str(e)})
    return {"processed": len(results), "results": results}
