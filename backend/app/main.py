from fastapi import FastAPI

from app.routes.grid import router as grid_router

app = FastAPI(title="Maritime Fusion Grid API")
app.include_router(grid_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
