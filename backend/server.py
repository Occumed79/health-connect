from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import os, uuid, csv, io, json, re, logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "healthconnect")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="Medical Provider Intelligence API")
api_router = APIRouter(prefix="/api")

class Service(BaseModel):
    name: str = ""
    price: Optional[float] = None
    currency: str = "USD"
    notes: str = ""

class Provider(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    specialty: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    services: List[Service] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    notes: str = ""
    source_type: str = "manual"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProviderCreate(BaseModel):
    name: str
    specialty: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    services: List[Service] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    notes: str = ""
    source_type: str = "manual"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    is_favorite: bool = False

class SearchRequest(BaseModel):
    query: str

class OutreachThreadCreate(BaseModel):
    agent_mode: str
    clinic_name: str
    contact_name: str = ""
    email: str = ""
    whatsapp: str = ""
    phone: str = ""
    city: str = ""
    country: str = ""
    language: str = "English"
    services_needed: str = ""
    context: str = ""
    tone: str = "professional, warm, concise"
    status: str = "new"
    latest_summary: str = ""

class OutreachThread(OutreachThreadCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutreachDraftRequest(BaseModel):
    agent_mode: str = "email-human"
    clinic_name: str
    contact_name: str = ""
    email: str = ""
    whatsapp: str = ""
    phone: str = ""
    city: str = ""
    country: str = ""
    language: str = "English"
    services_needed: str = ""
    context: str = ""
    tone: str = "professional, warm, concise"

class OutreachMessageCreate(BaseModel):
    thread_id: str
    channel: str
    direction: str
    body: str
    status: str = "logged"

class OutreachMessage(OutreachMessageCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutreachReplyParseRequest(OutreachDraftRequest):
    reply_text: str

class OutreachFollowupRequest(OutreachDraftRequest):
    reply_text: str
    analysis: Optional[Dict[str, Any]] = None

def clean_doc(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), str):
            try: doc[k] = datetime.fromisoformat(doc[k])
            except Exception: pass
    return doc

def serialize_for_mongo(data: dict):
    out = dict(data)
    for k in ("created_at", "updated_at"):
        if hasattr(out.get(k), "isoformat"):
            out[k] = out[k].isoformat()
    return out

def query_filter(q=None, specialty=None, city=None, state=None, favorite=None):
    f = {}
    if q:
        f["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"specialty": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"state": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
            {"services.name": {"$regex": q, "$options": "i"}},
        ]
    if specialty: f["specialty"] = {"$regex": specialty, "$options": "i"}
    if city: f["city"] = {"$regex": city, "$options": "i"}
    if state: f["state"] = {"$regex": state, "$options": "i"}
    if favorite is not None: f["is_favorite"] = favorite
    return f

def split_services(text: str) -> List[str]:
    return [s.strip() for s in re.split(r",|;|\n|\band\b", text or "", flags=re.I) if s.strip()]

def channel_for_mode(agent_mode: str) -> str:
    return "whatsapp" if "whatsapp" in (agent_mode or "") else "email"

def build_outreach_message(req: OutreachDraftRequest, followup: bool = False, reply_text: str = "", analysis: Optional[Dict[str, Any]] = None):
    channel = channel_for_mode(req.agent_mode)
    contact = req.contact_name.strip() or "there"
    services = req.services_needed.strip() or "the requested medical assessment services"
    location = ", ".join([x for x in [req.city, req.country] if x])
    location_line = f" in/near {location}" if location else ""
    intro = "Hello" if channel == "whatsapp" else f"Hello {contact},"
    if followup:
        summary = analysis.get("summary") if analysis else "Thank you for your response."
        unavailable = ", ".join(analysis.get("unavailable_services", [])) if analysis else ""
        ask = "Could you please confirm the remaining open items, including pricing, payment requirements, turnaround time, and whether your provider can complete the required forms?"
        if unavailable:
            ask = f"Could you please confirm whether you have a recommended nearby option for {unavailable}, and also confirm pricing, payment requirements, turnaround time, and whether your provider can complete the required forms?"
        message = f"{intro}\n\nThank you for your response. I noted the following: {summary}\n\n{ask}\n\nAs a reminder, these referrals are for assessment and documentation purposes only. The provider would not be clearing the individual for work.\n\nThank you."
    else:
        message = f"{intro}\n\nMy name is Alex, and I am reaching out on behalf of Occu-Med, a human resource and healthcare consultancy firm that coordinates pre-employment and periodic fitness-for-duty medical evaluations for deploying contractors and other client programs.\n\nWe are trying to confirm whether {req.clinic_name} can support an assessment-only referral{location_line}. Could you please confirm whether your facility can perform the following services:\n\n{services}\n\nCould you also please confirm:\n1. Whether your provider can document findings on forms supplied by Occu-Med or the requesting employer.\n2. Approximate pricing for each available service.\n3. Whether payment is required at the time of service, prepayment is required, or NET terms/corporate billing are available.\n4. Typical appointment availability and result turnaround time.\n\nTo clarify, the provider would not be clearing the individual for work. The provider would only perform the requested assessment/testing, document findings, and return the results to Occu-Med for review.\n\nThank you for your assistance."
    if channel == "whatsapp" and len(message) > 1400:
        message = message[:1375].rstrip() + "..."
    return {"agent_mode": req.agent_mode, "channel": channel, "message": message, "requires_human_approval": req.agent_mode == "email-human", "safety_note": "Do not include PHI. Escalate medical, legal, employment, or complex billing questions to a human."}

def parse_reply_text(req: OutreachReplyParseRequest):
    text = req.reply_text or ""
    low = text.lower()
    requested = split_services(req.services_needed)
    confirmed, unavailable = [], []
    for svc in requested:
        s = svc.lower()
        window = low[max(0, low.find(s) - 80): low.find(s) + len(s) + 120] if s in low else ""
        if s in low and not any(term in window for term in ["not", "don't", "do not", "cannot", "can't", "unable", "no "]):
            confirmed.append(svc)
        elif s in low and any(term in window for term in ["not", "don't", "do not", "cannot", "can't", "unable", "no "]):
            unavailable.append(svc)
    money = re.findall(r"(?:\$|usd\s*)\s?\d+(?:[,.]\d{2})?|\d+(?:[,.]\d{2})?\s?(?:usd|dollars|eur|euro|gbp|cad)", text, flags=re.I)
    payment_terms = []
    for key in ["prepay", "prepayment", "payment at time", "pay at time", "credit card", "net 30", "invoice", "cash", "deposit"]:
        if key in low:
            payment_terms.append(key)
    forms = "mentioned" if any(k in low for k in ["form", "forms", "paperwork", "complete", "sign"]) else "not mentioned"
    status = "needs follow-up"
    if unavailable and confirmed:
        status = "partial option"
    elif confirmed:
        status = "viable option"
    elif any(k in low for k in ["cannot", "unable", "do not offer", "not available"]):
        status = "not viable or limited"
    summary_parts = []
    if confirmed: summary_parts.append("Confirmed: " + ", ".join(confirmed))
    if unavailable: summary_parts.append("Unavailable: " + ", ".join(unavailable))
    if money: summary_parts.append("Pricing mentioned: " + ", ".join(money[:8]))
    if payment_terms: summary_parts.append("Payment terms mentioned: " + ", ".join(payment_terms))
    summary = "; ".join(summary_parts) or "Reply received, but the system could not confidently extract structured details. Human review recommended."
    follow_up = "Ask for missing pricing, payment terms, turnaround time, and form-completion confirmation."
    if unavailable:
        follow_up = "Ask whether they have a recommended nearby partner for unavailable services and confirm remaining pricing/payment details."
    return {"status": status, "confirmed_services": confirmed, "unavailable_services": unavailable, "pricing": ", ".join(money[:8]), "payment_terms": ", ".join(payment_terms), "forms": forms, "follow_up_needed": follow_up, "summary": summary, "raw_reply": text}

@api_router.get("/")
async def root():
    return {"message": "Medical Provider Intelligence API", "status": "ok"}

@api_router.get("/providers")
async def list_providers(
    q: Optional[str] = None,
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    favorite: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=1000),
):
    docs = await db.providers.find(query_filter(q, specialty, city, state, favorite), {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [clean_doc(d) for d in docs]

@api_router.post("/providers", response_model=Provider)
async def create_provider(payload: ProviderCreate):
    obj = Provider(**payload.model_dump())
    await db.providers.insert_one(serialize_for_mongo(obj.model_dump()))
    return obj

@api_router.post("/providers/bulk")
async def bulk_create(items: List[ProviderCreate]):
    providers = [Provider(**item.model_dump()) for item in items]
    if providers:
        await db.providers.insert_many([serialize_for_mongo(p.model_dump()) for p in providers])
    return {"created": len(providers), "items": providers}

@api_router.get("/providers/stats")
async def provider_stats():
    total = await db.providers.count_documents({})
    favorites = await db.providers.count_documents({"is_favorite": True})
    cities = await db.providers.distinct("city")
    specialties = await db.providers.distinct("specialty")
    return {"total_providers": total, "favorites": favorites, "cities": len([c for c in cities if c]), "specialties": len([s for s in specialties if s])}

@api_router.get("/providers/best-value")
async def best_value():
    docs = await db.providers.find({}, {"_id": 0}).to_list(1000)
    rows = []
    for d in docs:
        services = d.get("services") or []
        prices = [s.get("price") for s in services if isinstance(s.get("price"), (int, float))]
        if prices:
            d["lowest_price"] = min(prices)
            d["average_price"] = sum(prices) / len(prices)
            rows.append(clean_doc(d))
    rows.sort(key=lambda x: (x.get("lowest_price", 10**9), -(x.get("rating") or 0)))
    return rows[:25]

@api_router.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    doc = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider not found")
    return clean_doc(doc)

@api_router.put("/providers/{provider_id}")
async def update_provider(provider_id: str, payload: Dict[str, Any]):
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.providers.update_one({"id": provider_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    return clean_doc(await db.providers.find_one({"id": provider_id}, {"_id": 0}))

@api_router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: str):
    res = await db.providers.delete_one({"id": provider_id})
    return {"deleted": res.deleted_count}

@api_router.post("/providers/{provider_id}/favorite")
async def toggle_favorite(provider_id: str):
    doc = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider not found")
    new_val = not bool(doc.get("is_favorite"))
    await db.providers.update_one({"id": provider_id}, {"$set": {"is_favorite": new_val, "updated_at": datetime.now(timezone.utc).isoformat()}})
    doc["is_favorite"] = new_val
    return clean_doc(doc)

@api_router.post("/search/ai")
async def ai_search(req: SearchRequest):
    terms = [t for t in re.split(r"\W+", req.query) if len(t) > 2]
    if not terms:
        return []
    regex = "|".join(re.escape(t) for t in terms[:8])
    docs = await db.providers.find(query_filter(q=regex), {"_id": 0}).to_list(50)
    return [clean_doc(d) for d in docs]

@api_router.post("/extract")
async def extract_from_file(file: UploadFile = File(...)):
    content = await file.read()
    text = ""
    try:
        text = content.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    names = []
    for line in text.splitlines():
        line = line.strip()
        if line and len(line) < 120:
            names.append(line)
        if len(names) >= 5:
            break
    if not names:
        names = [file.filename or "Extracted provider"]
    return [{"name": names[0], "specialty": "", "address": "", "city": "", "state": "", "country": "", "phone": "", "email": "", "website": "", "services": [], "tags": ["ai-extracted"], "notes": "Auto-extracted placeholder. Review and edit before saving.", "source_type": "ai_extracted"}]

@api_router.get("/outreach/threads")
async def list_outreach_threads(agent_mode: Optional[str] = None, status: Optional[str] = None, limit: int = Query(100, ge=1, le=1000)):
    q = {}
    if agent_mode: q["agent_mode"] = agent_mode
    if status: q["status"] = status
    docs = await db.outreach_threads.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [clean_doc(d) for d in docs]

@api_router.post("/outreach/threads", response_model=OutreachThread)
async def create_outreach_thread(payload: OutreachThreadCreate):
    obj = OutreachThread(**payload.model_dump())
    await db.outreach_threads.insert_one(serialize_for_mongo(obj.model_dump()))
    return obj

@api_router.put("/outreach/threads/{thread_id}")
async def update_outreach_thread(thread_id: str, payload: Dict[str, Any]):
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.outreach_threads.update_one({"id": thread_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Outreach thread not found")
    return clean_doc(await db.outreach_threads.find_one({"id": thread_id}, {"_id": 0}))

@api_router.post("/outreach/draft")
async def draft_outreach_message(req: OutreachDraftRequest):
    return build_outreach_message(req)

@api_router.post("/outreach/messages", response_model=OutreachMessage)
async def log_outreach_message(payload: OutreachMessageCreate):
    obj = OutreachMessage(**payload.model_dump())
    await db.outreach_messages.insert_one(serialize_for_mongo(obj.model_dump()))
    await db.outreach_threads.update_one({"id": payload.thread_id}, {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return obj

@api_router.post("/outreach/replies/parse")
async def parse_outreach_reply(req: OutreachReplyParseRequest):
    return parse_reply_text(req)

@api_router.post("/outreach/followup/draft")
async def draft_outreach_followup(req: OutreachFollowupRequest):
    return build_outreach_message(req, followup=True, reply_text=req.reply_text, analysis=req.analysis)

@api_router.get("/export/csv")
async def export_csv():
    docs = await db.providers.find({}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","name","specialty","address","city","state","country","phone","email","website","services","tags","notes"])
    for d in docs:
        writer.writerow([d.get("id",""), d.get("name",""), d.get("specialty",""), d.get("address",""), d.get("city",""), d.get("state",""), d.get("country",""), d.get("phone",""), d.get("email",""), d.get("website",""), json.dumps(d.get("services",[])), ",".join(d.get("tags",[])), d.get("notes","")])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition":"attachment; filename=providers.csv"})

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
