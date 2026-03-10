"""NBA Betting Intelligence — standalone FastAPI backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sports

app = FastAPI(title="Sports Betting Intelligence", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(sports.router, prefix="/api", tags=["sports"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
