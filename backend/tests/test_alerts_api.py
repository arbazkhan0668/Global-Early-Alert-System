"""Backend tests for the Global Early Alert System API."""
import os
import json
import pytest
import requests
import websocket  # websocket-client

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend env file
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Root + Stats ----------------------------------------------------------
def test_root(client):
    r = client.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_stats(client):
    r = client.get(f"{BASE_URL}/api/alerts/stats")
    assert r.status_code == 200
    d = r.json()
    assert "total" in d and isinstance(d["total"], int)
    assert set(["weather", "disease", "conflict"]).issubset(d["by_category"].keys())
    assert set(["low", "moderate", "high", "critical"]).issubset(d["by_severity"].keys())
    assert d["total"] == sum(d["by_category"].values())


# --- Combined + Category Alerts -------------------------------------------
def test_get_all_alerts(client):
    r = client.get(f"{BASE_URL}/api/alerts")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    cats = {i["category"] for i in items}
    assert {"weather", "disease", "conflict"}.issubset(cats)
    sample = items[0]
    for k in ("id", "category", "subtype", "severity", "title", "description",
              "location", "country", "risk_score", "timestamp"):
        assert k in sample, f"missing {k}"
    assert "lat" in sample["location"] and "lng" in sample["location"]


@pytest.mark.parametrize("cat,path", [
    ("weather", "weather-alerts"),
    ("disease", "disease-alerts"),
    ("conflict", "conflict-alerts"),
])
def test_category_endpoints(client, cat, path):
    r = client.get(f"{BASE_URL}/api/{path}")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) > 0, f"{cat} returned empty"
    assert all(i["category"] == cat for i in items)


def test_filter_by_category_and_severity(client):
    r = client.get(f"{BASE_URL}/api/alerts", params={"category": "weather", "severity": "critical"})
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    for i in items:
        assert i["category"] == "weather"
        assert i["severity"] == "critical"


def test_filter_invalid_category(client):
    r = client.get(f"{BASE_URL}/api/alerts", params={"category": "bogus"})
    assert r.status_code == 422  # Pydantic regex validation


# --- Predict-Risk ---------------------------------------------------------
def test_predict_risk_anomaly(client):
    payload = {"series": [10, 11, 9, 10, 12, 11, 10, 50], "threshold": None}
    r = client.post(f"{BASE_URL}/api/predict-risk", json=payload)
    assert r.status_code == 200
    d = r.json()
    for k in ("risk_score", "severity", "z_score", "mean", "std", "anomaly", "reason"):
        assert k in d
    assert d["anomaly"] is True
    assert d["risk_score"] > 0
    assert d["severity"] in ("low", "moderate", "high", "critical")


def test_predict_risk_threshold(client):
    payload = {"series": [10, 12, 11, 13], "threshold": 12.5}
    r = client.post(f"{BASE_URL}/api/predict-risk", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["anomaly"] is True
    assert d["risk_score"] >= 0.9


def test_predict_risk_empty(client):
    r = client.post(f"{BASE_URL}/api/predict-risk", json={"series": []})
    assert r.status_code == 200
    d = r.json()
    assert d["anomaly"] is False
    assert d["risk_score"] == 0.0


# --- Refresh --------------------------------------------------------------
def test_refresh(client):
    r = client.post(f"{BASE_URL}/api/refresh")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "refreshed"
    assert "at" in d


# --- WebSocket ------------------------------------------------------------
def test_websocket_hello():
    ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
    ws = websocket.create_connection(ws_url, timeout=10)
    try:
        msg = ws.recv()
        data = json.loads(msg)
        assert data.get("type") == "hello"
        assert data.get("service") == "alerts-ws"
    finally:
        ws.close()
