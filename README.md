# Sports Betting Intelligence

XGBoost predictions vs Kalshi market prices. NBA live, NFL/NCAAB coming.

## Local Setup (2 terminals)

### 1. Clone & configure
```bash
cp .env.example .env
# Fill in BALLDONTLIE_API_KEY and KALSHI_API_KEY
```

### 2. Backend (Terminal 1)
```bash
bash backend/start.sh
# → http://localhost:8090
# → http://localhost:8090/docs  (Swagger UI)
```

### 3. Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite automatically proxies `/api/*` to the backend — no URL config needed.

### iPad / LAN access
```
http://YOUR_LAN_IP:5173
```
Vite binds to `0.0.0.0` by default so any device on your network can reach it.

---

## Deployment (free)

### Frontend → Vercel
```bash
cd frontend
npm run build          # produces dist/
# Push to GitHub, connect repo at vercel.com
# Set env var: VITE_API_URL=https://your-backend.fly.dev
```

### Backend → Fly.io (free tier)
```bash
cd backend
fly launch             # follow prompts, Dockerfile is already there
fly secrets set BALLDONTLIE_API_KEY=... KALSHI_API_KEY=...
fly deploy
```

---

## Project Structure
```
nba-dashboard/
├── backend/
│   ├── nba/              ← XGBoost model, Kalshi/BallDontLie fetchers
│   ├── routers/sports.py ← single GET /api/predictions endpoint
│   ├── main.py           ← FastAPI app (8090)
│   ├── requirements.txt
│   └── start.sh          ← local venv launcher
├── frontend/
│   ├── src/
│   │   ├── App.tsx       ← main dashboard
│   │   ├── components/   ← GameCard, TopPicks, MarketTable, …
│   │   ├── lib/api.ts    ← typed API client
│   │   └── types/        ← TypeScript interfaces
│   ├── index.html
│   ├── vite.config.ts    ← dev proxy + build config
│   └── package.json
├── .env.example
└── README.md
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/sports` | List all sports + availability |
| GET | `/api/predictions?sport=nba&w_xgb=1.0` | Live predictions |
| GET | `/docs` | Swagger UI |
