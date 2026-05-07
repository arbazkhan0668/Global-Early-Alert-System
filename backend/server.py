"""Global Early Alert System - FastAPI backend.

Aggregates weather, disease, and conflict alerts with anomaly detection
and broadcasts new alerts over WebSockets.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
import resend
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Logging & Mongo
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("alert-system")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "").strip()
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip()
SUBSCRIPTION_THROTTLE_SECONDS = 600  # max 1 email / 10 min per subscriber

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ---------------------------------------------------------------------------
# Reference cities for weather sampling (global coverage)
# ---------------------------------------------------------------------------
SAMPLE_CITIES: List[Dict[str, Any]] = [
    {"name": "New York", "country": "USA", "lat": 40.7128, "lng": -74.0060},
    {"name": "Los Angeles", "country": "USA", "lat": 34.0522, "lng": -118.2437},
    {"name": "Mexico City", "country": "Mexico", "lat": 19.4326, "lng": -99.1332},
    {"name": "São Paulo", "country": "Brazil", "lat": -23.5505, "lng": -46.6333},
    {"name": "Buenos Aires", "country": "Argentina", "lat": -34.6037, "lng": -58.3816},
    {"name": "London", "country": "UK", "lat": 51.5074, "lng": -0.1278},
    {"name": "Paris", "country": "France", "lat": 48.8566, "lng": 2.3522},
    {"name": "Madrid", "country": "Spain", "lat": 40.4168, "lng": -3.7038},
    {"name": "Berlin", "country": "Germany", "lat": 52.5200, "lng": 13.4050},
    {"name": "Moscow", "country": "Russia", "lat": 55.7558, "lng": 37.6176},
    {"name": "Cairo", "country": "Egypt", "lat": 30.0444, "lng": 31.2357},
    {"name": "Lagos", "country": "Nigeria", "lat": 6.5244, "lng": 3.3792},
    {"name": "Nairobi", "country": "Kenya", "lat": -1.2921, "lng": 36.8219},
    {"name": "Riyadh", "country": "Saudi Arabia", "lat": 24.7136, "lng": 46.6753},
    {"name": "Dubai", "country": "UAE", "lat": 25.2048, "lng": 55.2708},
    {"name": "Mumbai", "country": "India", "lat": 19.0760, "lng": 72.8777},
    {"name": "New Delhi", "country": "India", "lat": 28.6139, "lng": 77.2090},
    {"name": "Bangkok", "country": "Thailand", "lat": 13.7563, "lng": 100.5018},
    {"name": "Jakarta", "country": "Indonesia", "lat": -6.2088, "lng": 106.8456},
    {"name": "Beijing", "country": "China", "lat": 39.9042, "lng": 116.4074},
    {"name": "Shanghai", "country": "China", "lat": 31.2304, "lng": 121.4737},
    {"name": "Tokyo", "country": "Japan", "lat": 35.6762, "lng": 139.6503},
    {"name": "Seoul", "country": "South Korea", "lat": 37.5665, "lng": 126.9780},
    {"name": "Sydney", "country": "Australia", "lat": -33.8688, "lng": 151.2093},
    {"name": "Phoenix", "country": "USA", "lat": 33.4484, "lng": -112.0740},
]

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Location(BaseModel):
    lat: float
    lng: float


class Alert(BaseModel):
    """A single alert. Categories: weather, disease, conflict."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # 'weather' | 'disease' | 'conflict'
    subtype: str  # 'heatwave' | 'flood' | 'storm' | 'rain' | 'outbreak' | 'conflict'
    severity: str  # 'low' | 'moderate' | 'high' | 'critical'
    title: str
    description: str
    location: Location
    country: str
    region: Optional[str] = None
    risk_score: float = 0.0
    metrics: Dict[str, Any] = Field(default_factory=dict)
    source: str = "mock"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RiskRequest(BaseModel):
    series: List[float]  # time series of values (e.g., temperature/cases per day)
    threshold: Optional[float] = None  # absolute threshold for hard alerts


class RiskResponse(BaseModel):
    risk_score: float
    severity: str
    z_score: float
    mean: float
    std: float
    anomaly: bool
    reason: str


SEVERITY_ORDER = {"low": 0, "moderate": 1, "high": 2, "critical": 3}


class SubscriptionCreate(BaseModel):
    email: EmailStr
    categories: List[str] = Field(default_factory=lambda: ["weather", "disease", "conflict"])
    min_severity: str = "high"


class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    categories: List[str]
    min_severity: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_sent_at: Optional[datetime] = None


class TestEmail(BaseModel):
    email: EmailStr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _doc_from_alert(a: Alert) -> Dict[str, Any]:
    d = a.model_dump()
    d["timestamp"] = d["timestamp"].isoformat()
    d["geo"] = {"type": "Point", "coordinates": [a.location.lng, a.location.lat]}
    return d


def _alert_from_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc.pop("_id", None)
    doc.pop("geo", None)
    if isinstance(doc.get("timestamp"), str):
        try:
            doc["timestamp"] = datetime.fromisoformat(doc["timestamp"])
        except ValueError:
            pass
    return doc


def _severity_from_score(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.65:
        return "high"
    if score >= 0.4:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# Anomaly detection (z-score)
# ---------------------------------------------------------------------------
def detect_anomaly(values: List[float], threshold: Optional[float] = None) -> RiskResponse:
    if not values:
        return RiskResponse(
            risk_score=0.0, severity="low", z_score=0.0, mean=0.0, std=0.0,
            anomaly=False, reason="empty series",
        )
    n = len(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / max(n - 1, 1)
    std = var ** 0.5
    latest = values[-1]
    z = (latest - mean) / std if std > 1e-9 else 0.0
    # Map z (clipped at 4) to risk score
    risk = min(max(abs(z) / 4.0, 0.0), 1.0)
    anomaly = abs(z) >= 2.0
    reason = f"z-score {z:.2f} vs mean {mean:.2f}"
    if threshold is not None and latest >= threshold:
        risk = max(risk, 0.9)
        anomaly = True
        reason = f"latest {latest:.2f} ≥ threshold {threshold:.2f}"
    return RiskResponse(
        risk_score=round(risk, 3),
        severity=_severity_from_score(risk),
        z_score=round(z, 3),
        mean=round(mean, 3),
        std=round(std, 3),
        anomaly=anomaly,
        reason=reason,
    )


# ---------------------------------------------------------------------------
# Data sources (with mock fallback)
# ---------------------------------------------------------------------------
async def fetch_weather_alerts() -> List[Alert]:
    """Fetch live weather from OpenWeatherMap or fall back to mock."""
    alerts: List[Alert] = []
    if OPENWEATHER_API_KEY:
        async with httpx.AsyncClient(timeout=8.0) as http:
            for city in SAMPLE_CITIES:
                try:
                    r = await http.get(
                        "https://api.openweathermap.org/data/2.5/weather",
                        params={
                            "lat": city["lat"], "lon": city["lng"],
                            "appid": OPENWEATHER_API_KEY, "units": "metric",
                        },
                    )
                    if r.status_code != 200:
                        continue
                    d = r.json()
                    temp = d.get("main", {}).get("temp")
                    humidity = d.get("main", {}).get("humidity")
                    weather_main = (d.get("weather") or [{}])[0].get("main", "")
                    rain_1h = d.get("rain", {}).get("1h", 0)
                    a = _classify_weather(city, temp, humidity, weather_main, rain_1h, "openweathermap")
                    if a:
                        alerts.append(a)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("OpenWeather fetch failed for %s: %s", city["name"], exc)
        if alerts:
            return alerts
    # Fallback mock
    return _mock_weather_alerts()


def _classify_weather(
    city: Dict[str, Any], temp: Optional[float], humidity: Optional[float],
    weather_main: str, rain_1h: float, source: str,
) -> Optional[Alert]:
    if temp is None:
        return None
    metrics = {"temp_c": temp, "humidity": humidity, "rain_1h_mm": rain_1h, "weather": weather_main}
    if temp >= 45:
        return _make_alert("weather", "heatwave", "critical", 0.95,
                           f"Extreme heatwave in {city['name']}",
                           f"Temperature {temp:.1f}°C exceeds extreme threshold (45°C).",
                           city, metrics, source)
    if temp >= 40:
        return _make_alert("weather", "heatwave", "high", 0.8,
                           f"Heatwave warning in {city['name']}",
                           f"Temperature {temp:.1f}°C is dangerously high.",
                           city, metrics, source)
    if temp >= 35:
        return _make_alert("weather", "heatwave", "moderate", 0.55,
                           f"Elevated heat in {city['name']}",
                           f"Temperature {temp:.1f}°C — heat advisory threshold.",
                           city, metrics, source)
    if rain_1h >= 30:
        return _make_alert("weather", "flood", "critical", 0.9,
                           f"Heavy rainfall / flood risk in {city['name']}",
                           f"Rainfall {rain_1h:.1f}mm/h indicates flood risk.",
                           city, metrics, source)
    if rain_1h >= 5:
        sev = "high" if rain_1h >= 10 else "moderate"
        score = 0.7 if rain_1h >= 10 else 0.45
        return _make_alert("weather", "rain", sev, score,
                           f"Heavy rain in {city['name']}",
                           f"Rainfall {rain_1h:.1f}mm/h.",
                           city, metrics, source)
    if weather_main.lower() in {"thunderstorm", "tornado", "squall"}:
        return _make_alert("weather", "storm", "high", 0.7,
                           f"Severe storm near {city['name']}",
                           f"{weather_main} detected near {city['name']}.",
                           city, metrics, source)
    if temp <= -15:
        return _make_alert("weather", "storm", "moderate", 0.5,
                           f"Extreme cold in {city['name']}",
                           f"Temperature {temp:.1f}°C — cold wave advisory.",
                           city, metrics, source)
    if temp >= 32:
        return _make_alert("weather", "heatwave", "low", 0.4,
                           f"Warm conditions in {city['name']}",
                           f"Temperature {temp:.1f}°C — monitor for heat advisory.",
                           city, metrics, source)
    if temp >= 30 and humidity is not None and humidity >= 75:
        return _make_alert("weather", "heatwave", "low", 0.35,
                           f"High humidity heat in {city['name']}",
                           f"{temp:.1f}°C with {humidity:.0f}% humidity — discomfort index elevated.",
                           city, metrics, source)
    return None


def _make_alert(category, subtype, severity, score, title, desc, city, metrics, source) -> Alert:
    return Alert(
        category=category, subtype=subtype, severity=severity,
        title=title, description=desc,
        location=Location(lat=city["lat"], lng=city["lng"]),
        country=city["country"], region=city["name"],
        risk_score=score, metrics=metrics, source=source,
    )


def _mock_weather_alerts() -> List[Alert]:
    out: List[Alert] = []
    seed = int(datetime.now(timezone.utc).timestamp() // 600)  # rotates every 10 min
    rng = random.Random(seed)
    chosen = rng.sample(SAMPLE_CITIES, 10)
    for c in chosen:
        roll = rng.random()
        if roll < 0.35:
            temp = rng.uniform(42, 49)
            out.append(_make_alert(
                "weather", "heatwave", "critical" if temp >= 45 else "high",
                0.9 if temp >= 45 else 0.75,
                f"Heatwave alert in {c['name']}",
                f"Temperature {temp:.1f}°C — heat advisory in effect.",
                c, {"temp_c": round(temp, 1), "humidity": rng.randint(20, 60)}, "mock",
            ))
        elif roll < 0.65:
            mm = rng.uniform(15, 60)
            out.append(_make_alert(
                "weather", "flood" if mm > 30 else "rain",
                "critical" if mm > 30 else "moderate",
                0.9 if mm > 30 else 0.55,
                f"{'Flood risk' if mm > 30 else 'Heavy rain'} in {c['name']}",
                f"Rainfall {mm:.1f}mm/h sustained.",
                c, {"rain_1h_mm": round(mm, 1), "humidity": rng.randint(70, 95)}, "mock",
            ))
        else:
            out.append(_make_alert(
                "weather", "storm", "high", 0.7,
                f"Tropical storm near {c['name']}",
                "High-velocity winds and lightning reported.",
                c, {"wind_kph": rng.randint(80, 140)}, "mock",
            ))
    return out


def _mock_disease_alerts() -> List[Alert]:
    """Stand-in for WHO/CDC outbreak datasets."""
    base = [
        {"city": "Kinshasa", "country": "DR Congo", "lat": -4.4419, "lng": 15.2663,
         "disease": "Mpox", "cases": 312, "trend": "spike"},
        {"city": "Dhaka", "country": "Bangladesh", "lat": 23.8103, "lng": 90.4125,
         "disease": "Dengue", "cases": 1480, "trend": "rising"},
        {"city": "Manila", "country": "Philippines", "lat": 14.5995, "lng": 120.9842,
         "disease": "Dengue", "cases": 920, "trend": "rising"},
        {"city": "Kampala", "country": "Uganda", "lat": 0.3476, "lng": 32.5825,
         "disease": "Ebola (suspected)", "cases": 14, "trend": "monitor"},
        {"city": "Lima", "country": "Peru", "lat": -12.0464, "lng": -77.0428,
         "disease": "Cholera", "cases": 210, "trend": "rising"},
        {"city": "Karachi", "country": "Pakistan", "lat": 24.8607, "lng": 67.0011,
         "disease": "Cholera", "cases": 540, "trend": "spike"},
        {"city": "Sao Luis", "country": "Brazil", "lat": -2.5307, "lng": -44.3068,
         "disease": "Yellow Fever", "cases": 38, "trend": "monitor"},
    ]
    out: List[Alert] = []
    for b in base:
        sev = "critical" if b["trend"] == "spike" else ("high" if b["trend"] == "rising" else "moderate")
        score = {"spike": 0.9, "rising": 0.7, "monitor": 0.45}[b["trend"]]
        out.append(Alert(
            category="disease", subtype="outbreak", severity=sev,
            title=f"{b['disease']} outbreak in {b['city']}",
            description=f"{b['cases']} reported cases — trend: {b['trend']}.",
            location=Location(lat=b["lat"], lng=b["lng"]),
            country=b["country"], region=b["city"],
            risk_score=score,
            metrics={"disease": b["disease"], "cases": b["cases"], "trend": b["trend"]},
            source="who-mock",
        ))
    return out


def _mock_conflict_alerts() -> List[Alert]:
    """Stand-in for ACLED dataset (verified conflict reporting only)."""
    base = [
        {"region": "Eastern Ukraine", "country": "Ukraine", "lat": 48.0, "lng": 37.8,
         "events": 27, "fatalities": 41, "type": "Armed clash"},
        {"region": "Khartoum", "country": "Sudan", "lat": 15.5007, "lng": 32.5599,
         "events": 18, "fatalities": 60, "type": "Armed clash"},
        {"region": "Gaza Strip", "country": "Palestine", "lat": 31.5, "lng": 34.45,
         "events": 22, "fatalities": 35, "type": "Strikes/violence"},
        {"region": "Sahel Region", "country": "Mali", "lat": 17.5707, "lng": -3.9962,
         "events": 9, "fatalities": 12, "type": "Insurgent activity"},
        {"region": "North Kivu", "country": "DR Congo", "lat": -1.6793, "lng": 29.2336,
         "events": 11, "fatalities": 18, "type": "Armed clash"},
        {"region": "Yangon", "country": "Myanmar", "lat": 16.8409, "lng": 96.1735,
         "events": 6, "fatalities": 4, "type": "Civil unrest"},
    ]
    out: List[Alert] = []
    for b in base:
        if b["fatalities"] >= 30:
            sev, score = "critical", 0.92
        elif b["fatalities"] >= 10:
            sev, score = "high", 0.75
        else:
            sev, score = "moderate", 0.5
        out.append(Alert(
            category="conflict", subtype="conflict", severity=sev,
            title=f"{b['type']} reported — {b['region']}",
            description=f"{b['events']} incidents, {b['fatalities']} fatalities recorded (last 7 days).",
            location=Location(lat=b["lat"], lng=b["lng"]),
            country=b["country"], region=b["region"],
            risk_score=score,
            metrics={"events_7d": b["events"], "fatalities_7d": b["fatalities"], "type": b["type"]},
            source="acled-mock",
        ))
    return out


# ---------------------------------------------------------------------------
# Cache layer (MongoDB) — refresh every N seconds
# ---------------------------------------------------------------------------
CACHE_TTL_SECONDS = 300  # 5 min
_cache_meta: Dict[str, datetime] = {}


async def _refresh_category(category: str) -> List[Alert]:
    alerts: List[Alert] = []
    if category == "weather":
        alerts = await fetch_weather_alerts()
    elif category == "disease":
        alerts = _mock_disease_alerts()
    elif category == "conflict":
        alerts = _mock_conflict_alerts()
    else:
        return []
    # Replace category in DB
    await db.alerts.delete_many({"category": category})
    if alerts:
        await db.alerts.insert_many([_doc_from_alert(a) for a in alerts])
    _cache_meta[category] = datetime.now(timezone.utc)
    logger.info("Refreshed %s alerts (%d)", category, len(alerts))
    return alerts


async def _ensure_fresh(category: str) -> None:
    last = _cache_meta.get(category)
    if last is None or (datetime.now(timezone.utc) - last) > timedelta(seconds=CACHE_TTL_SECONDS):
        await _refresh_category(category)


async def _get_alerts(category: Optional[str] = None) -> List[Dict[str, Any]]:
    cats = [category] if category else ["weather", "disease", "conflict"]
    for c in cats:
        await _ensure_fresh(c)
    q: Dict[str, Any] = {}
    if category:
        q["category"] = category
    docs = await db.alerts.find(q, {"_id": 0, "geo": 0}).sort("risk_score", -1).to_list(500)
    return [_alert_from_doc(d) for d in docs]


# ---------------------------------------------------------------------------
# Email dispatcher (Resend)
# ---------------------------------------------------------------------------
def _build_alert_email_html(alert: Dict[str, Any]) -> str:
    color_map = {
        "weather": "#FF3B30",
        "disease": "#34C759",
        "conflict": "#FFCC00",
    }
    color = color_map.get(alert["category"], "#007AFF")
    risk_pct = int(round(alert.get("risk_score", 0) * 100))
    return f"""
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0A0F14;font-family:Inter,Arial,sans-serif;color:#fff;padding:24px">
  <tr><td>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#11161D;border:1px solid #1F242C;border-radius:16px;overflow:hidden">
      <tr><td style="padding:24px 24px 8px">
        <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:{color};font-weight:700">
          {alert['category']} · {alert['severity']} · risk {risk_pct}%
        </div>
        <h1 style="margin:8px 0 0;font-size:22px;color:#fff">{alert['title']}</h1>
      </td></tr>
      <tr><td style="padding:8px 24px 0;color:#A1A1AA;font-size:14px;line-height:1.5">
        {alert['description']}
      </td></tr>
      <tr><td style="padding:16px 24px 24px;color:#71717A;font-size:12px">
        <strong style="color:#fff">Location:</strong> {alert.get('region','')}{', ' if alert.get('region') else ''}{alert.get('country','')}<br>
        <strong style="color:#fff">Source:</strong> {alert.get('source','mock')}
      </td></tr>
      <tr><td style="padding:0 24px 24px">
        <div style="height:1px;background:#1F242C;margin-bottom:16px"></div>
        <div style="font-size:11px;color:#71717A">
          You're receiving this because you subscribed to Global Early Alert System updates.
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
""".strip()


async def _send_email(to: str, subject: str, html: str) -> Optional[str]:
    """Send email via Resend; returns email id or None on failure."""
    if not RESEND_API_KEY:
        logger.info("[email mock] would send to %s: %s", to, subject)
        return None
    try:
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        return result.get("id") if isinstance(result, dict) else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("resend send failed for %s: %s", to, exc)
        return None


async def _dispatch_alert_to_subscribers(alert: Dict[str, Any]) -> int:
    """Match a new alert to subscribers and send emails (throttled)."""
    if not RESEND_API_KEY:
        return 0
    subs = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
    sent = 0
    now = datetime.now(timezone.utc)
    sev_rank = SEVERITY_ORDER.get(alert.get("severity", "low"), 0)
    for s in subs:
        if alert["category"] not in s.get("categories", []):
            continue
        if sev_rank < SEVERITY_ORDER.get(s.get("min_severity", "high"), 2):
            continue
        last_iso = s.get("last_sent_at")
        if last_iso:
            last = datetime.fromisoformat(last_iso) if isinstance(last_iso, str) else last_iso
            if (now - last).total_seconds() < SUBSCRIPTION_THROTTLE_SECONDS:
                continue
        html = _build_alert_email_html(alert)
        subject = f"[{alert['severity'].upper()}] {alert['title']}"
        email_id = await _send_email(s["email"], subject, html)
        if email_id:
            await db.subscriptions.update_one(
                {"id": s["id"]},
                {"$set": {"last_sent_at": now.isoformat()}},
            )
            sent += 1
    if sent:
        logger.info("dispatched alert %s to %d subscribers", alert.get("title"), sent)
    return sent


# ---------------------------------------------------------------------------
# WebSocket broadcaster
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        dead: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for d in dead:
            self.disconnect(d)


manager = ConnectionManager()


async def _periodic_pulse() -> None:
    """Background task: simulate new alerts and broadcast over WebSockets."""
    await asyncio.sleep(5)
    while True:
        try:
            cat = random.choice(["weather", "disease", "conflict"])
            await _refresh_category(cat)
            new_alerts = await _get_alerts(cat)
            if new_alerts:
                pick = random.choice(new_alerts)
                await manager.broadcast({"type": "alert", "alert": pick})
                # Best-effort email dispatch to matching subscribers
                try:
                    await _dispatch_alert_to_subscribers(pick)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("dispatch failed: %s", exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("pulse failed: %s", exc)
        await asyncio.sleep(30)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # Indexes
    try:
        await db.alerts.create_index([("geo", "2dsphere")])
        await db.alerts.create_index("category")
        await db.alerts.create_index("timestamp")
    except Exception as exc:  # noqa: BLE001
        logger.warning("index creation: %s", exc)
    # Warm cache
    for c in ("weather", "disease", "conflict"):
        try:
            await _refresh_category(c)
        except Exception as exc:  # noqa: BLE001
            logger.warning("warm cache %s: %s", c, exc)
    pulse_task = asyncio.create_task(_periodic_pulse())
    try:
        yield
    finally:
        pulse_task.cancel()
        client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"service": "global-early-alert-system", "status": "ok"}


@api_router.get("/alerts", response_model=List[Alert])
async def get_all_alerts(
    category: Optional[str] = Query(None, pattern="^(weather|disease|conflict)$"),
    severity: Optional[str] = Query(None, pattern="^(low|moderate|high|critical)$"),
    limit: int = Query(200, ge=1, le=1000),
):
    items = await _get_alerts(category)
    if severity:
        items = [a for a in items if a.get("severity") == severity]
    return items[:limit]


@api_router.get("/weather-alerts", response_model=List[Alert])
async def weather_alerts():
    return await _get_alerts("weather")


@api_router.get("/disease-alerts", response_model=List[Alert])
async def disease_alerts():
    return await _get_alerts("disease")


@api_router.get("/conflict-alerts", response_model=List[Alert])
async def conflict_alerts():
    return await _get_alerts("conflict")


@api_router.get("/alerts/stats")
async def alerts_stats():
    items = await _get_alerts(None)
    by_cat: Dict[str, int] = {"weather": 0, "disease": 0, "conflict": 0}
    by_sev: Dict[str, int] = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    for a in items:
        by_cat[a["category"]] = by_cat.get(a["category"], 0) + 1
        by_sev[a["severity"]] = by_sev.get(a["severity"], 0) + 1
    return {
        "total": len(items),
        "by_category": by_cat,
        "by_severity": by_sev,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/sources")
async def sources_status():
    """Reports which data sources are configured live vs mock."""
    items = await _get_alerts(None)
    sources_by_cat: Dict[str, set] = {"weather": set(), "disease": set(), "conflict": set()}
    for a in items:
        sources_by_cat.setdefault(a["category"], set()).add(a.get("source", "unknown"))
    return {
        "weather": {
            "live": bool(OPENWEATHER_API_KEY) and "openweathermap" in sources_by_cat.get("weather", set()),
            "provider": "OpenWeatherMap" if OPENWEATHER_API_KEY else "mock",
            "sources": sorted(sources_by_cat.get("weather", set())),
        },
        "disease": {
            "live": False,
            "provider": "WHO/CDC (mock)",
            "sources": sorted(sources_by_cat.get("disease", set())),
        },
        "conflict": {
            "live": False,
            "provider": "ACLED (mock)",
            "sources": sorted(sources_by_cat.get("conflict", set())),
        },
        "email": {
            "live": bool(RESEND_API_KEY),
            "provider": "Resend" if RESEND_API_KEY else "disabled",
            "sender": SENDER_EMAIL if RESEND_API_KEY else None,
        },
    }


@api_router.post("/predict-risk", response_model=RiskResponse)
async def predict_risk(payload: RiskRequest):
    return detect_anomaly(payload.series, payload.threshold)


@api_router.post("/refresh")
async def refresh_alerts():
    """Manual trigger to refresh all categories."""
    for c in ("weather", "disease", "conflict"):
        await _refresh_category(c)
    return {"status": "refreshed", "at": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------
@api_router.post("/subscribe", response_model=Subscription)
async def create_subscription(payload: SubscriptionCreate):
    valid_cats = {"weather", "disease", "conflict"}
    cats = [c for c in payload.categories if c in valid_cats]
    if not cats:
        raise HTTPException(status_code=400, detail="At least one valid category required")
    if payload.min_severity not in SEVERITY_ORDER:
        raise HTTPException(status_code=400, detail="Invalid severity")
    sub = Subscription(
        email=payload.email,
        categories=cats,
        min_severity=payload.min_severity,
    )
    doc = sub.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["last_sent_at"] = None
    await db.subscriptions.insert_one(doc)
    # Send welcome / confirmation email (best-effort)
    welcome_html = (
        "<div style='font-family:Inter,Arial,sans-serif;background:#0A0F14;color:#fff;padding:24px'>"
        "<h2 style='margin:0 0 8px'>Subscription confirmed</h2>"
        f"<p style='color:#A1A1AA;font-size:14px'>You'll receive Global Early Alert System notifications for "
        f"<strong>{', '.join(cats)}</strong> at <strong>{payload.min_severity}+</strong> severity.</p>"
        "<p style='color:#71717A;font-size:12px;margin-top:16px'>Throttle: max 1 email / 10 min per subscriber.</p>"
        "</div>"
    )
    email_id = await _send_email(
        payload.email,
        "[GEAS] Subscription confirmed",
        welcome_html,
    )
    if email_id:
        logger.info("welcome email sent to %s (id=%s)", payload.email, email_id)
    return sub


@api_router.get("/subscriptions/{email}", response_model=List[Subscription])
async def list_subscriptions(email: EmailStr):
    docs = await db.subscriptions.find({"email": email}, {"_id": 0}).to_list(100)
    out = []
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
        if isinstance(d.get("last_sent_at"), str):
            d["last_sent_at"] = datetime.fromisoformat(d["last_sent_at"])
        out.append(d)
    return out


@api_router.delete("/subscribe/{sub_id}")
async def delete_subscription(sub_id: str):
    res = await db.subscriptions.delete_one({"id": sub_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"status": "deleted", "id": sub_id}


@api_router.post("/test-email")
async def test_email(payload: TestEmail):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=400, detail="RESEND_API_KEY not configured")
    sample = {
        "category": "weather",
        "subtype": "heatwave",
        "severity": "high",
        "title": "Heatwave warning in Bangkok",
        "description": "This is a test email from Global Early Alert System.",
        "country": "Thailand",
        "region": "Bangkok",
        "risk_score": 0.78,
        "source": "test",
    }
    html = _build_alert_email_html(sample)
    eid = await _send_email(payload.email, "[GEAS][TEST] Heatwave warning", html)
    if not eid:
        raise HTTPException(status_code=502, detail="Resend send failed (likely test-mode restriction or invalid recipient)")
    return {"status": "sent", "email_id": eid}


@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # initial snapshot
        await ws.send_json({"type": "hello", "service": "alerts-ws"})
        while True:
            await ws.receive_text()  # ignore incoming for now
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ws closed: %s", exc)
        manager.disconnect(ws)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
