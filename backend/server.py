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
    return {
        "total_providers": total,
        "favorites": favorites,
        "cities": len([c for c in cities if c]),
        "specialties": len([s for s in specialties if s]),
    }

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
    # Lightweight local fallback: keyword search. Replace with LLM enrichment if desired.
    terms = [t for t in re.split(r"\W+", req.query) if len(t) > 2]
    if not terms:
        return []
    regex = "|".join(re.escape(t) for t in terms[:8])
    docs = await db.providers.find(query_filter(q=regex), {"_id": 0}).to_list(50)
    return [clean_doc(d) for d in docs]

@api_router.post("/extract")
async def extract_from_file(file: UploadFile = File(...)):
    # Safe fallback parser. Original AI extraction can be reconnected with a fresh API key.
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
    return [{
        "name": names[0],
        "specialty": "",
        "address": "",
        "city": "",
        "state": "",
        "country": "",
        "phone": "",
        "email": "",
        "website": "",
        "services": [],
        "tags": ["ai-extracted"],
        "notes": "Auto-extracted placeholder. Review and edit before saving.",
        "source_type": "ai_extracted"
    }]

@api_router.get("/export/csv")
async def export_csv():
    docs = await db.providers.find({}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id","name","specialty","address","city","state","country","phone","email","website","services","tags","notes"])
    for d in docs:
        writer.writerow([
            d.get("id",""), d.get("name",""), d.get("specialty",""), d.get("address",""),
            d.get("city",""), d.get("state",""), d.get("country",""), d.get("phone",""),
            d.get("email",""), d.get("website",""),
            json.dumps(d.get("services",[])), ",".join(d.get("tags",[])), d.get("notes","")
        ])
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
