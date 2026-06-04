import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.grid import router as grid_router

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="Maritime Fusion Grid API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(grid_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
