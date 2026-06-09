# Maritime Fusion Grid

Maritime Fusion Grid is a personal full-stack project for exploring maritime activity on a global map. The current version combines fishing activity derived from AIS with SAR vessel detections, then builds a separate Fusion Review layer that ranks areas an analyst may want to inspect first.

The goal is not to prove anything from incomplete data. The goal is to show how multiple maritime signals can be brought into one analyst-facing workflow: source layers, fused review areas, explainable scoring, clickable evidence, and a queue of places to look next.

## Current Features

- Global MapLibre basemap with deck.gl overlays
- Fishing effort layer from AIS-derived activity
- SAR vessel detection layer
- SAR match filter:
  - `All`
  - `Matched`
  - `Unmatched`
- Fusion Review Areas layer
- Priority queue of top loaded Fusion cells
- Clickable map cells with selected outlines
- Hover outlines and pointer cursor for selectable cells
- Details panel for raw source cells and Fusion review cells
- Timeline control using daily selected dates over a rolling 7-day review window
- Manual Fusion refresh button for reloading review areas at the current map view
- FastAPI backend proxy for tile, bin, source-cell, and Fusion requests
- Railway-ready frontend/backend environment configuration

## Fusion Review

Fusion Review is the main feature of the project.

The raw source layers answer:

```text
What activity is visible?
```

Fusion Review tries to answer:

```text
Where should I look first, and why?
```

The backend builds Fusion Review Areas by pulling the same tile/cell structure for:

- fishing effort
- matched SAR detections
- unmatched SAR detections

Those inputs are merged by cell id. The backend then assigns each cell a priority score from 0 to 100 and returns a GeoJSON review layer for the frontend to render.

The score is rule-based for now. It increases when unmatched SAR detections are present, when the unmatched ratio is high, and when there is enough SAR evidence to make the cue worth reviewing. Fishing effort is used as context, not proof.

Each Fusion cell includes:

- priority score
- priority bucket
- assessment label
- fishing AIS hours
- SAR matched detections
- SAR unmatched detections
- unmatched ratio
- confidence
- generated reasons
- caveats

The language is intentionally cautious. A Fusion Review Area is a cue for analyst follow-up, not a final determination.

## Tech Stack

Frontend:

- React
- TypeScript
- Vite
- MapLibre GL
- deck.gl

Backend:

- Python
- FastAPI
- mapbox-vector-tile
- uv

Deployment:

- Railway for the current hosted version
- Vite frontend service
- FastAPI backend service

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── routes/
│   │   │   └── gfw.py
│   │   ├── schemas/
│   │   │   └── gfw.py
│   │   └── services/
│   │       ├── fusion.py
│   │       ├── gfw_client.py
│   │       └── gfw_tiles.py
│   ├── .env.example
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── public/
│   │   ├── favicon.svg
│   │   └── styles/
│   │       └── maritime-dark.json
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── map/
│   │   ├── styles/
│   │   └── types/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── docs/
└── README.md
```

The backend is still intentionally small, but the responsibilities are split: routes define HTTP endpoints, services handle data access/tile decoding/Fusion scoring, schemas hold shared backend shapes, and config owns environment-backed settings.

## Local Setup

### 1. Backend

From the repo root:

```powershell
cd backend
uv sync
copy .env.example .env
```

Then edit `backend/.env` and set:

```text
GFW_API_TOKEN=your_token_here
```

Run the backend:

```powershell
uv run fastapi dev app/main.py --port 8000
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### 2. Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server runs at:

```text
http://localhost:5173
```

During local development, the frontend calls `/api/...`. Vite proxies that to:

```text
http://127.0.0.1:8000
```

That proxy is configured in `frontend/vite.config.ts`.

## Environment Variables

Backend:

```text
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
GFW_API_TOKEN=
GFW_AIS_DATASET=public-global-fishing-effort:latest
GFW_SAR_DATASET=public-global-sar-presence:latest
GFW_DATE_RANGE=2026-01-01,2026-06-01
```

Frontend:

```text
VITE_API_BASE_URL=https://your-backend.up.railway.app
```

Locally, `VITE_API_BASE_URL` can stay unset so Vite uses the `/api` proxy.

## Useful Commands

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Backend smoke check:

```powershell
cd backend
uv run python -c "from fastapi.testclient import TestClient; from app.main import app; c=TestClient(app); r=c.get('/health'); print(r.status_code, r.json())"
```

Fusion tile smoke check:

```powershell
cd backend
uv run python -c "from fastapi.testclient import TestClient; from app.main import app; c=TestClient(app); r=c.get('/gfw/fusion/tiles/0/0/0?date=2026-01-08&scoreVersion=2'); body=r.json(); print(r.status_code, body['type'], len(body['features']))"
```

## What This Project Is Not

This project does not prove illegal fishing, sanctions evasion, smuggling, or any other activity.

It also does not currently ingest raw AIS or raw SAR data, partially due to not finding much accessible global OSINT in this area. The current version depends on external processed maritime datasets exposed through an API.

## Next Steps

In the future, useful features are:

- add saved findings with PostgreSQL/PostGIS
- add an analyst note field for selected Fusion cells
- improve Fusion scoring with neighboring-cell context
- add persistence across multiple review windows
- add tests around the backend Fusion scoring functions
- EEZ / Exclusive economic zone boundaries 
- Filtering by flag / country

## License

This project uses the Apache License 2.0.

External data sources, APIs, map tiles, and datasets remain governed by their own terms.
