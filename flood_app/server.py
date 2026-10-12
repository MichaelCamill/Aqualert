import os
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_FILE = os.path.join(os.path.dirname(__file__), "data", "database.json")
MANDATORY_RETENTION_DAYS = 15

app = FastAPI(
    title="Aqualert: Emergency Flood & SOS Intelligence Engine",
    description="Space-Borne & Ground Flood Risk Management, 15-Day Retention Compliance, and SOS Dispatch Engine",
    version="2.0.0"
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_db() -> Dict[str, Any]:
    if not os.path.exists(DB_FILE):
        return {"zones": [], "flood_prone_areas": [], "sos_reports": [], "preferences": {}}
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(data: Dict[str, Any]):
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Normalize trailing Z
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def compute_zone_retention(zone: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes strict 15-day retention metrics for flooded zones:
    Rule 6: After a flood, flooded zone reports cannot be ignored for at least half a month (15 days).
    """
    now = datetime.now(timezone.utc)
    zone_copy = dict(zone)
    flood_date = parse_iso_datetime(zone.get("flood_date"))
    
    if zone.get("type") == "flooded" and flood_date:
        locked_until = flood_date + timedelta(days=MANDATORY_RETENTION_DAYS)
        zone_copy["locked_until"] = locked_until.isoformat()
        
        diff = locked_until - now
        if diff.total_seconds() > 0:
            zone_copy["is_locked_15_days"] = True
            days = diff.days
            hours = int((diff.seconds) / 3600)
            minutes = int((diff.seconds % 3600) / 60)
            zone_copy["retention_remaining_days"] = days
            zone_copy["retention_remaining_hours"] = hours
            zone_copy["retention_status_text"] = f"LOCKED: {days}d {hours}h remaining in mandatory 15-day post-flood watch"
            zone_copy["cannot_ignore_reason"] = (
                f"SAFETY PROTOCOL ENFORCED: Inundated on {flood_date.strftime('%Y-%m-%d %H:%M UTC')}. "
                f"Reports and active monitoring cannot be dismissed or ignored for at least 15 days "
                f"(Locked until {locked_until.strftime('%Y-%m-%d %H:%M UTC')})."
            )
        else:
            zone_copy["is_locked_15_days"] = False
            zone_copy["retention_remaining_days"] = 0
            zone_copy["retention_remaining_hours"] = 0
            zone_copy["retention_status_text"] = "15-day mandatory watch completed. Archiving permitted."
            zone_copy["cannot_ignore_reason"] = None
    else:
        zone_copy["is_locked_15_days"] = False
        zone_copy["retention_remaining_days"] = 0
        zone_copy["retention_remaining_hours"] = 0
        zone_copy["retention_status_text"] = "Standard monitoring"
        zone_copy["cannot_ignore_reason"] = None
        
    return zone_copy

# ----------------- Models -----------------
class ZoneCreate(BaseModel):
    name: str
    type: str = Field(..., description="'safe', 'nearby', 'unsafe', or 'flooded'")
    water_level_m: float = 0.0
    flood_date: Optional[str] = None
    severity: str = "Moderate"
    affected_population: int = 0
    submerged_roads_km: float = 0.0
    damaged_bridges: int = 0
    center: List[float]  # [lng, lat]
    polygon: Optional[List[List[float]]] = None
    description: str = ""

class FloodProneCreate(BaseModel):
    name: str
    river_basin: str
    risk_level: str = "High"  # "Extreme", "High", "Moderate"
    historical_frequency: str = "Monsoon Vulnerable"
    elevation_m: float = 1200.0
    coordinates: List[float]  # [lng, lat]
    radius_m: float = 1500.0
    polygon: Optional[List[List[float]]] = None
    marked_by: str = "Field Analyst"
    notes: str = ""

class SOSCreate(BaseModel):
    caller_name: str
    phone: str
    location_name: str
    latitude: float
    longitude: float
    zone_id: Optional[str] = None
    trapped_count: int = 1
    children_count: int = 0
    elderly_count: int = 0
    medical_emergency: bool = False
    urgency: str = "Critical"  # "Critical", "High", "Medium"
    needs: List[str] = []
    message: str = ""

class PreferencesUpdate(BaseModel):
    remember_filters: bool = True
    saved_filters: Dict[str, Any]

# ----------------- Endpoints: Zones -----------------
@app.get("/api/zones")
def get_zones(zone_type: Optional[str] = None):
    db = load_db()
    zones = db.get("zones", [])
    processed = [compute_zone_retention(z) for z in zones]
    if zone_type:
        processed = [z for z in processed if z.get("type") == zone_type.lower()]
    return processed

@app.post("/api/zones", status_code=status.HTTP_201_CREATED)
def create_zone(payload: ZoneCreate):
    color_map = {
        "safe": "#10B981",    # 1. Green - safe zone
        "nearby": "#F59E0B",  # 2. Yellow - Flood Nearby
        "unsafe": "#F97316",  # 3. Orange - Unsafe zone
        "flooded": "#EF4444"  # 4. Red - Flooded Zone
    }
    z_type = payload.type.lower()
    if z_type not in color_map:
        raise HTTPException(status_code=400, detail="Zone type must be: safe, nearby, unsafe, or flooded")
    
    db = load_db()
    zone_id = f"zone-{z_type}-{int(datetime.now().timestamp())}"
    now_iso = datetime.now(timezone.utc).isoformat()
    flood_date = payload.flood_date if payload.flood_date else (now_iso if z_type == "flooded" else None)
    
    new_zone = {
        "id": zone_id,
        "name": payload.name,
        "type": z_type,
        "color": color_map[z_type],
        "status": "Active Alert" if z_type == "flooded" else "Monitored",
        "water_level_m": payload.water_level_m,
        "flood_date": flood_date,
        "retention_days": MANDATORY_RETENTION_DAYS if z_type == "flooded" else 0,
        "severity": payload.severity,
        "affected_population": payload.affected_population,
        "submerged_roads_km": payload.submerged_roads_km,
        "damaged_bridges": payload.damaged_bridges,
        "center": payload.center,
        "polygon": payload.polygon or [],
        "description": payload.description,
    }
    
    db["zones"].append(new_zone)
    save_db(db)
    return compute_zone_retention(new_zone)

@app.delete("/api/zones/{zone_id}")
def delete_or_dismiss_zone(zone_id: str, force: bool = False):
    """
    Rule 6 Enforcement:
    After a flood, flooded zone reports cannot be ignored or deleted for at least 15 days.
    """
    db = load_db()
    target = None
    for z in db["zones"]:
        if z["id"] == zone_id:
            target = z
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Zone not found")
        
    evaluated = compute_zone_retention(target)
    if evaluated.get("is_locked_15_days") and not force:
        raise HTTPException(
            status_code=403,
            detail=(
                f"ACTION PROHIBITED BY MANDATORY 15-DAY RETENTION PROTOCOL: "
                f"This flooded zone report was recorded on {target.get('flood_date')}. "
                f"Flooded zones cannot be ignored, dismissed, or deleted for at least half a month (15 days). "
                f"{evaluated.get('retention_remaining_days')} days and {evaluated.get('retention_remaining_hours')} hours remaining."
            )
        )
        
    db["zones"] = [z for z in db["zones"] if z["id"] != zone_id]
    save_db(db)
    return {"success": True, "message": f"Zone {zone_id} removed"}

# ----------------- Endpoints: Flood Prone Areas -----------------
@app.get("/api/flood-prone")
def get_flood_prone_areas():
    db = load_db()
    return db.get("flood_prone_areas", [])

@app.post("/api/flood-prone", status_code=status.HTTP_201_CREATED)
def mark_flood_prone_area(payload: FloodProneCreate):
    """
    Rule 5: Flood prone areas can be marked.
    """
    db = load_db()
    fp_id = f"fp-{int(datetime.now().timestamp())}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    new_area = {
        "id": fp_id,
        "name": payload.name,
        "river_basin": payload.river_basin,
        "risk_level": payload.risk_level,
        "historical_frequency": payload.historical_frequency,
        "elevation_m": payload.elevation_m,
        "coordinates": payload.coordinates,
        "radius_m": payload.radius_m,
        "polygon": payload.polygon or [],
        "marked_by": payload.marked_by,
        "marked_date": now_iso,
        "notes": payload.notes
    }
    
    db["flood_prone_areas"].append(new_area)
    save_db(db)
    return new_area

@app.delete("/api/flood-prone/{fp_id}")
def delete_flood_prone_area(fp_id: str):
    db = load_db()
    initial_len = len(db.get("flood_prone_areas", []))
    db["flood_prone_areas"] = [fp for fp in db.get("flood_prone_areas", []) if fp["id"] != fp_id]
    if len(db["flood_prone_areas"]) == initial_len:
        raise HTTPException(status_code=404, detail="Flood prone area not found")
    save_db(db)
    return {"success": True, "message": f"Area {fp_id} deleted"}

# ----------------- Endpoints: SOS Reporting System -----------------
@app.get("/api/sos")
def get_sos_reports(status_filter: Optional[str] = None):
    db = load_db()
    reports = db.get("sos_reports", [])
    if status_filter and status_filter.upper() != "ALL":
        reports = [r for r in reports if r.get("status") == status_filter.upper()]
    return reports

@app.post("/api/sos", status_code=status.HTTP_201_CREATED)
def submit_sos_report(payload: SOSCreate):
    """
    Rule 7: Reporting SOS system.
    """
    db = load_db()
    sos_id = f"SOS-{datetime.now().strftime('%Y%m%d')}-{len(db.get('sos_reports', [])) + 1:03d}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    new_report = {
        "id": sos_id,
        "caller_name": payload.caller_name,
        "phone": payload.phone,
        "location_name": payload.location_name,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "zone_id": payload.zone_id,
        "trapped_count": payload.trapped_count,
        "children_count": payload.children_count,
        "elderly_count": payload.elderly_count,
        "medical_emergency": payload.medical_emergency,
        "urgency": payload.urgency,
        "needs": payload.needs,
        "status": "PENDING",
        "dispatched_unit": None,
        "eta_minutes": None,
        "timestamp": now_iso,
        "message": payload.message
    }
    
    db["sos_reports"].insert(0, new_report)  # Most recent first
    save_db(db)
    return new_report

@app.patch("/api/sos/{sos_id}/dispatch")
def dispatch_rescue_unit(sos_id: str, unit_name: str = "Rescue Unit Alpha", eta_minutes: int = 15):
    db = load_db()
    for report in db.get("sos_reports", []):
        if report["id"] == sos_id:
            report["status"] = "DISPATCHED"
            report["dispatched_unit"] = unit_name
            report["eta_minutes"] = eta_minutes
            save_db(db)
            return report
    raise HTTPException(status_code=404, detail="SOS report not found")

@app.patch("/api/sos/{sos_id}/resolve")
def resolve_sos(sos_id: str):
    db = load_db()
    for report in db.get("sos_reports", []):
        if report["id"] == sos_id:
            report["status"] = "RESCUED"
            save_db(db)
            return report
    raise HTTPException(status_code=404, detail="SOS report not found")

# ----------------- Endpoints: Filters ("Yaad Karlo") -----------------
@app.get("/api/preferences")
def get_preferences():
    """
    Rule 8: Filters (yaad karlo) - Persistent filter storage.
    """
    db = load_db()
    return db.get("preferences", {
        "remember_filters": True,
        "saved_filters": {
            "show_green": True,
            "show_yellow": True,
            "show_orange": True,
            "show_red": True,
            "show_flood_prone": True,
            "show_15day_locked_only": False,
            "sos_status": "ALL",
            "search_query": ""
        }
    })

@app.post("/api/preferences")
def save_preferences(payload: PreferencesUpdate):
    """
    Rule 8: Filters (yaad karlo) - Saves filter settings for persistent session memory.
    """
    db = load_db()
    db["preferences"] = {
        "remember_filters": payload.remember_filters,
        "saved_filters": payload.saved_filters,
        "last_saved": datetime.now(timezone.utc).isoformat()
    }
    save_db(db)
    return {"status": "saved", "message": "Filters yaad kar liye gaye hain (Filters persistently saved)!"}

# ----------------- Endpoints: Analytics Summary -----------------
@app.get("/api/summary")
def get_summary():
    db = load_db()
    zones = [compute_zone_retention(z) for z in db.get("zones", [])]
    sos = db.get("sos_reports", [])
    fp = db.get("flood_prone_areas", [])
    
    red_zones = [z for z in zones if z.get("type") == "flooded"]
    orange_zones = [z for z in zones if z.get("type") == "unsafe"]
    yellow_zones = [z for z in zones if z.get("type") == "nearby"]
    green_zones = [z for z in zones if z.get("type") == "safe"]
    
    locked_count = len([z for z in zones if z.get("is_locked_15_days")])
    pending_sos = [s for s in sos if s.get("status") == "PENDING"]
    dispatched_sos = [s for s in sos if s.get("status") == "DISPATCHED"]
    total_trapped = sum(s.get("trapped_count", 0) for s in sos if s.get("status") != "RESCUED")
    
    return {
        "total_zones": len(zones),
        "zone_counts": {
            "green_safe": len(green_zones),
            "yellow_nearby": len(yellow_zones),
            "orange_unsafe": len(orange_zones),
            "red_flooded": len(red_zones)
        },
        "locked_15_day_zones": locked_count,
        "flood_prone_marked_areas": len(fp),
        "sos_metrics": {
            "total_calls": len(sos),
            "pending": len(pending_sos),
            "dispatched": len(dispatched_sos),
            "total_trapped_people": total_trapped
        },
        "infrastructure_damage": {
            "total_submerged_roads_km": round(sum(z.get("submerged_roads_km", 0) for z in zones), 2),
            "destroyed_bridges": sum(z.get("damaged_bridges", 0) for z in zones)
        }
    }

# ----------------- Endpoints: Emergency Contacts & Dispatch (Requirement 4) -----------------
@app.get("/api/emergency-contacts")
def get_emergency_contacts():
    db = load_db()
    return db.get("emergency_contacts", [])

class DispatchOrder(BaseModel):
    incident_id: Optional[str] = None
    target_location: Optional[str] = "Disaster Hotspot"
    notes: Optional[str] = "Immediate rescue sortie requested"

@app.post("/api/emergency-contacts/{contact_id}/dispatch")
def dispatch_emergency_contact(contact_id: str, order: DispatchOrder):
    db = load_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    for c in db.get("emergency_contacts", []):
        if c["id"] == contact_id:
            c["dispatch_status"] = f"DISPATCHED ON MISSION: {order.target_location}"
            c["last_dispatch"] = {
                "timestamp": now_iso,
                "incident_id": order.incident_id,
                "target": order.target_location,
                "notes": order.notes
            }
            save_db(db)
            return {"success": True, "message": f"{c['title']} dispatched immediately!", "contact": c}
    raise HTTPException(status_code=404, detail="Contact not found")

# ----------------- Endpoints: 1-Click Situation Report Generator (Requirement 4) -----------------
@app.get("/api/reports/generate")
def generate_situation_report():
    """
    Requirement 4: 1-Click Official Situation Report Generator.
    Generates structured NDRF/Disaster Authority SitRep.
    """
    db = load_db()
    zones = [compute_zone_retention(z) for z in db.get("zones", [])]
    sos = db.get("sos_reports", [])
    now = datetime.now(timezone.utc)
    
    red_zones = [z for z in zones if z.get("type") == "flooded"]
    orange_zones = [z for z in zones if z.get("type") == "unsafe"]
    yellow_zones = [z for z in zones if z.get("type") == "nearby"]
    green_zones = [z for z in zones if z.get("type") == "safe"]
    
    pending_sos = [s for s in sos if s.get("status") == "PENDING"]
    dispatched_sos = [s for s in sos if s.get("status") == "DISPATCHED"]
    rescued_sos = [s for s in sos if s.get("status") == "RESCUED"]
    total_trapped = sum(s.get("trapped_count", 0) for s in sos if s.get("status") != "RESCUED")
    medical_emergencies = len([s for s in sos if s.get("medical_emergency") and s.get("status") != "RESCUED"])

    sitrep_id = f"SITREP-{now.strftime('%Y%m%d-%H%M')}"

    report = {
        "report_id": sitrep_id,
        "classification": "RESTRICTED / OPERATIONAL DISASTER BRIEFING",
        "authorizing_authority": "Aqualert Command Center & State Disaster Management",
        "timestamp_utc": now.isoformat(),
        "timestamp_formatted": now.strftime("%d %B %Y, %H:%M UTC"),
        "executive_summary": (
            f"Active disaster response underway across {len(red_zones)} flooded critical sectors. "
            f"{len(pending_sos)} pending distress signals, with an estimated {total_trapped} persons trapped. "
            f"{medical_emergencies} critical medical triage emergencies requiring priority helicopter air-lift."
        ),
        "hazard_summary": {
            "critical_flooded_zones": len(red_zones),
            "severe_hazard_zones": len(orange_zones),
            "advisory_buffer_zones": len(yellow_zones),
            "designated_safe_havens": len(green_zones),
            "total_submerged_roads_km": round(sum(z.get("submerged_roads_km", 0) for z in zones), 2),
            "damaged_bridges": sum(z.get("damaged_bridges", 0) for z in zones)
        },
        "survivor_triage": {
            "total_reports_logged": len(sos),
            "pending_dispatch": len(pending_sos),
            "units_actively_dispatched": len(dispatched_sos),
            "rescued_to_safety": len(rescued_sos),
            "total_trapped_headcount": total_trapped,
            "critical_medical_cases": medical_emergencies
        },
        "critical_flooded_zones_detail": [
            {
                "name": z["name"],
                "water_depth_m": z["water_level_m"],
                "severity": z["severity"],
                "population_at_risk": z["affected_population"],
                "15_day_retention_lock": z.get("retention_status_text", "Active")
            }
            for z in red_zones
        ],
        "urgent_air_lift_targets": [
            {
                "sos_id": s["id"],
                "name": s["caller_name"],
                "location": s["location_name"],
                "coordinates": [s["latitude"], s["longitude"]],
                "trapped": s["trapped_count"],
                "needs": s["needs"],
                "notes": s["message"]
            }
            for s in pending_sos if s.get("medical_emergency") or s.get("urgency") == "Critical"
        ][:8],
        "compliance_declaration": (
            "This report is generated under the National Disaster Framework. "
            "Rule 6 Enforced: All flooded zone records remain under mandatory 15-day non-ignorable retention."
        ),
        "nepali": {
            "title": "घटना वस्तुस्थिति प्रतिवेदन (SITREP)",
            "classification": "गोप्य / सञ्चालन विपद् जानकारी (RESTRICTED BRIEFING)",
            "authorizing_authority": "एक्वालर्ट कमाण्ड सेन्टर तथा राष्ट्रिय विपद् व्यवस्थापन प्राधिकरण",
            "executive_summary": (
                f"{len(red_zones)} वटा जलमग्न संवेदनशील क्षेत्रहरूमा सक्रिय आपत्कालीन विपद् उद्धार कार्य जारी छ। "
                f"{len(pending_sos)} वटा उद्धार संकेतहरू विचाराधीन छन्, जसमा अनुमानित {total_trapped} जना व्यक्तिहरू फसेका छन्। "
                f"{medical_emergencies} वटा गम्भीर चिकित्सा आपत्कालहरूलाई उच्च प्राथमिकताका साथ हेलिकप्टर एयरलिफ्ट आवश्यक छ।"
            ),
            "compliance_declaration": (
                "यो प्रतिवेदन राष्ट्रिय विपद् व्यवस्थापन ढाँचा अन्तर्गत तयार पारिएको हो। "
                "नियम ६ लागु: सबै जलमग्न क्षेत्रका विवरणहरू कम्तीमा १५ दिनसम्म अनिवार्य रूपमा सुरक्षित र सक्रिय रहनेछन्।"
            ),
            "labels": {
                "critical_flooded_zones": "जलमग्न संवेदनशील क्षेत्र",
                "trapped_count": "फसेका व्यक्तिहरूको संख्या",
                "medical_airlift": "हेलिकप्टर एयरलिफ्ट आवश्यक",
                "safe_havens": "सुरक्षित आश्रयस्थलहरू",
                "zone_breakdown": "जलमग्न संवेदनशील क्षेत्रहरूको विस्तृत विवरण",
                "airlift_targets": "प्राथमिकता प्राप्त हेलिकप्टर तथा डुङ्गा उद्धार सूची",
                "zone_name": "क्षेत्रको नाम",
                "water_depth": "पानीको गहिराइ",
                "hazard_level": "जोखिम स्तर",
                "population_at_risk": "जोखिममा रहेको जनसंख्या",
                "retention_status": "१५-दिने अभिलेख स्थिति",
                "trapped_badge": "जना फसेका",
                "verified_seal": "राज्य कमाण्ड छाप प्रमाणित"
            }
        }
    }
    return report

# ----------------- Endpoints: Bulk Survivors (Requirement 5) -----------------
@app.get("/api/survivors")
def get_survivors(
    query: Optional[str] = None,
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    medical_only: Optional[bool] = False,
    page: int = 1,
    page_size: int = 25
):
    db = load_db()
    reports = db.get("sos_reports", [])

    if query:
        q = query.lower()
        reports = [r for r in reports if q in r.get("caller_name", "").lower() or q in r.get("location_name", "").lower() or q in r.get("id", "").lower()]
    
    if status and status.upper() != "ALL":
        reports = [r for r in reports if r.get("status") == status.upper()]
        
    if urgency and urgency.upper() != "ALL":
        reports = [r for r in reports if r.get("urgency") == urgency]

    if medical_only:
        reports = [r for r in reports if r.get("medical_emergency") is True]

    total_count = len(reports)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = reports[start:end]

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 1,
        "items": paginated
    }

class SurvivorStatusUpdate(BaseModel):
    status: str  # PENDING, DISPATCHED, RESCUED, IN_CONTACT
    assigned_unit: Optional[str] = None
    eta_minutes: Optional[int] = None
    officer_notes: Optional[str] = None

@app.patch("/api/survivors/{sos_id}/action")
def update_survivor_status(sos_id: str, payload: SurvivorStatusUpdate):
    db = load_db()
    for r in db.get("sos_reports", []):
        if r["id"] == sos_id:
            r["status"] = payload.status.upper()
            if payload.assigned_unit:
                r["dispatched_unit"] = payload.assigned_unit
            if payload.eta_minutes is not None:
                r["eta_minutes"] = payload.eta_minutes
            if payload.officer_notes:
                r["message"] = f"{r.get('message', '')} | Officer Note: {payload.officer_notes}"
# ----------------- Endpoints: Survivor KYC, Hazard Check & Helpers -----------------
class SurvivorKYC(BaseModel):
    full_name: str
    phone: str
    gov_id_type: str = "Aadhaar Card"  # "Aadhaar Card", "Voter ID", "Passport", "Driving License"
    gov_id_number: str
    emergency_contact_name: str
    emergency_contact_phone: str
    latitude: float = 19.0178
    longitude: float = 72.8478
    location_sharing_enabled: bool = True

@app.post("/api/survivor/kyc")
def submit_survivor_kyc(payload: SurvivorKYC):
    """
    Survivor Requirement 2: KYC completed once during login.
    Includes: 1 government id, enable location sharing, emergency contacts, phone number.
    """
    db = load_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    profiles = db.get("survivor_profiles", [])

    # Update or insert profile
    existing = next((p for p in profiles if p.get("phone") == payload.phone), None)
    profile_data = {
        "full_name": payload.full_name,
        "phone": payload.phone,
        "gov_id_type": payload.gov_id_type,
        "gov_id_number": payload.gov_id_number,
        "emergency_contact_name": payload.emergency_contact_name,
        "emergency_contact_phone": payload.emergency_contact_phone,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "location_sharing_enabled": payload.location_sharing_enabled,
        "kyc_verified": True,
        "verified_at": now_iso
    }

    if existing:
        existing.update(profile_data)
    else:
        profiles.append(profile_data)

    db["survivor_profiles"] = profiles
    save_db(db)
    return {"success": True, "message": "KYC Verified Successfully. Lifeline Active.", "profile": profile_data}

@app.get("/api/survivor/kyc/{phone}")
def get_survivor_kyc(phone: str):
    db = load_db()
    for p in db.get("survivor_profiles", []):
        if p.get("phone") == phone:
            return {"found": True, "profile": p}
    return {"found": False, "profile": None}

def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

@app.get("/api/hazard-check")
def check_survivor_hazard_level(lat: float, lng: float):
    """
    Survivor Requirement 3: Survivors can see their hazard level on the map.
    Checks live geofencing against active zones and calculates nearest safe haven.
    """
    db = load_db()
    zones = [compute_zone_retention(z) for z in db.get("zones", [])]

    current_hazard = {
        "level": 1,
        "level_name": "Level 1: Safe Haven (Minimal Hazard)",
        "color": "#10B981",
        "zone_name": "Normal Elevated Area",
        "water_depth_m": 0.0,
        "advisory": "Current location is outside active flood zones. Keep battery charged and maintain radio monitoring."
    }

    # Find closest zone
    closest_zone = None
    min_dist = float("inf")

    safe_havens = [z for z in zones if z.get("type") == "safe"]
    closest_safe_haven = None
    min_safe_dist = float("inf")

    for z in zones:
        dist = calculate_distance_km(lat, lng, z["center"][1], z["center"][0])
        if dist < min_dist:
            min_dist = dist
            closest_zone = z

        if z.get("type") == "safe" and dist < min_safe_dist:
            min_safe_dist = dist
            closest_safe_haven = z

    if closest_zone and min_dist <= 2.8:
        z_type = closest_zone.get("type")
        if z_type == "flooded":
            current_hazard = {
                "level": 4,
                "level_name": "LEVEL 4: CRITICAL FLOODED ZONE (EXTREME DANGER)",
                "color": "#EF4444",
                "zone_name": closest_zone["name"],
                "water_depth_m": closest_zone.get("water_level_m", 2.8),
                "distance_to_center_km": min_dist,
                "advisory": f"URGENT: You are inside or adjacent to {closest_zone['name']}. Water level is {closest_zone.get('water_level_m')}m. Submerged roads and flash torrents active. Transmit 1-touch SOS immediately or move to higher floors."
            }
        elif z_type == "unsafe":
            current_hazard = {
                "level": 3,
                "level_name": "LEVEL 3: UNSAFE SWELL ZONE (SEVERE HAZARD)",
                "color": "#F97316",
                "zone_name": closest_zone["name"],
                "water_depth_m": closest_zone.get("water_level_m", 1.5),
                "distance_to_center_km": min_dist,
                "advisory": f"High risk of water swell and road erosion. Avoid ground floor passages and underpasses."
            }
        elif z_type == "nearby":
            current_hazard = {
                "level": 2,
                "level_name": "LEVEL 2: FLOOD NEARBY (WATERLOGGING WARNING)",
                "color": "#F59E0B",
                "zone_name": closest_zone["name"],
                "water_depth_m": closest_zone.get("water_level_m", 0.6),
                "distance_to_center_km": min_dist,
                "advisory": f"Rising water buffer within 500m. Precautionary evacuation to nearest elevated shelter advised."
            }

    return {
        "current_hazard": current_hazard,
        "nearest_safe_haven": {
            "name": closest_safe_haven["name"] if closest_safe_haven else "Designated District Safe Camp",
            "distance_km": min_safe_dist if min_safe_dist != float("inf") else 2.5,
            "coordinates": closest_safe_haven["center"] if closest_safe_haven else [72.805, 18.955],
            "description": closest_safe_haven.get("description", "Equipped with food, drinking water and medical aid.") if closest_safe_haven else "High ground relief center."
        }
    }

@app.get("/api/helpers/nearby")
def get_nearby_helpers(lat: float = 19.0178, lng: float = 72.8478):
    """
    Survivor Requirement 4: Call and send emergency report to nearby helpers within a few clicks.
    """
    db = load_db()
    helpers = db.get("nearby_helpers", [])
    result = []

    for h in helpers:
        dist = calculate_distance_km(lat, lng, h["latitude"], h["longitude"])
        h_copy = dict(h)
        h_copy["distance_km"] = dist
        result.append(h_copy)

    result.sort(key=lambda x: x["distance_km"])
    return result

class AlertHelperPayload(BaseModel):
    survivor_name: str
    survivor_phone: str
    latitude: float
    longitude: float
    situation_notes: str = "Urgent waterlogged distress. Immediate assistance requested."

@app.post("/api/helpers/{helper_id}/alert")
def alert_nearby_helper(helper_id: str, payload: AlertHelperPayload):
    """
    Survivor Requirement 4: Send emergency report to nearby helper in 1 click.
    """
    db = load_db()
    for h in db.get("nearby_helpers", []):
        if h["id"] == helper_id:
            # Also log as high-priority SOS in government database
            sos_id = f"SOS-HELPER-{int(datetime.now().timestamp())}"
            new_sos = {
                "id": sos_id,
                "caller_name": payload.survivor_name,
                "phone": payload.survivor_phone,
                "location_name": f"Direct Alert to {h['name']} ({h['vehicle']})",
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "zone_id": "zone-mum-red-1",
                "trapped_count": 2,
                "children_count": 0,
                "elderly_count": 0,
                "medical_emergency": True,
                "urgency": "Critical",
                "needs": ["Direct Helper Assistance", "Rescue Vehicle"],
                "status": "DISPATCHED",
                "dispatched_unit": h["name"],
                "eta_minutes": int(max(4, h.get("distance_km", 2) * 4)),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": payload.situation_notes
            }
            db.setdefault("sos_reports", []).insert(0, new_sos)
            save_db(db)

            return {
                "success": True,
                "message": f"EMERGENCY REPORT TRANSMITTED TO {h['name']} ({h['phone']})! Helper has been alerted with your exact GPS ({payload.latitude:.4f}, {payload.longitude:.4f}).",
                "helper": h,
                "sos_ticket": sos_id,
                "estimated_eta_minutes": new_sos["eta_minutes"]
            }
    raise HTTPException(status_code=404, detail="Helper not found")

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Aqualert Public Portal"}

@app.get("/gov")
def serve_government_portal():
    gov_file = os.path.join(static_dir, "gov.html")
    if os.path.exists(gov_file):
        return FileResponse(gov_file)
    return {"message": "Government Portal initializing..."}

@app.get("/survivor")
def serve_survivor_portal():
    surv_file = os.path.join(static_dir, "survivor.html")
    if os.path.exists(surv_file):
        return FileResponse(surv_file)
    return {"message": "Survivor Portal initializing..."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

