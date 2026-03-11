"""NBA Betting Intelligence — standalone FastAPI backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import sports, tracker

app = FastAPI(title="Sports Betting Intelligence", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(sports.router,  prefix="/api", tags=["sports"])
app.include_router(tracker.router, prefix="/api", tags=["tracker"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
