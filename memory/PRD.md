# Global Early Alert System — PRD

## Original Problem
Production-ready web app providing real-time alerts and map-based visualization for:
- Weather (rain, heatwaves, humidity)
- Natural disasters (floods, storms)
- Disease outbreaks
- Conflict zones (verified reporting only)

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) — REST + WebSocket. Combined with AI/anomaly layer (single service).
- **Frontend**: React + react-leaflet (CartoDB Dark Matter tiles) + Tailwind + shadcn/ui + framer-motion + sonner.
- **DB**: MongoDB with 2dsphere geospatial index on `alerts.geo`.
- **Real-time**: WebSocket `/api/ws` broadcasts a new alert every ~30s (background pulse task).

## User Personas
- Emergency response analyst monitoring global situational picture
- Journalist / NGO researcher tracking concurrent crises
- General citizen exploring global risk zones

## Core Requirements (Static)
- Color-coded markers: Red=heatwave, Blue=rain/flood, Green=disease, Yellow=conflict
- Glassmorphism dark UI with map as primary focus
- Filters: category toggles, severity slider, time-window slider
- Live alerts feed with severity indicators
- Anomaly detection endpoint
- Mock fallback when external APIs unavailable

## What's Been Implemented (2026-02)
- Backend `server.py`:
  - `GET /api/alerts` (filters: category, severity, limit)
  - `GET /api/weather-alerts`, `/api/disease-alerts`, `/api/conflict-alerts`
  - `GET /api/alerts/stats`
  - `POST /api/predict-risk` (z-score + threshold-based anomaly)
  - `POST /api/refresh` (manual cache refresh)
  - `WS /api/ws` (live alert broadcasts)
  - OpenWeatherMap integration with mock fallback (auto-activates when no key)
  - WHO/CDC + ACLED stand-in mock datasets
- Frontend dashboard (`/`):
  - Full-screen Leaflet dark map (CartoDB) with custom pulsing DivIcon markers
  - Glassmorphism `StatsHeader`, `FilterPanel`, `AlertsFeed`, `TimelineBar`
  - WebSocket subscription with toast notifications + connection indicator
  - Severity slider, time-window slider, heatmap toggle
  - Click marker → popup; click feed card → fly-to + popup

## Test Status
- Backend: 13/13 pytest cases passing (REST + WebSocket)
- Frontend: full dashboard verified, no console errors

## Backlog
### P1
- Wire real OpenWeatherMap key (user-provided) for live weather
- Risk heatmap layer (currently toggle-only) — integrate `leaflet.heat`
- Email/SMS alert subscriptions (deferred per user choice)
- "Mocked data" banner when no API key configured

### P2
- Geospatial query endpoint (`/api/alerts/near?lat&lng&radius_km`)
- Historical timeline replay (server-side time-bucketed data)
- ACLED real-data ingestion (CSV pull)
- NASA FIRMS fire integration
- User location detection + bbox filter
- Multi-language UI

### P0 Remaining
- None blocking MVP

## Next Tasks
1. Allow user to add OPENWEATHER_API_KEY in .env for live weather
2. Add real heatmap rendering layer
3. Add subscription/notification system if user requests
