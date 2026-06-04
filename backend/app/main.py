from fastapi import FastAPI

app = FastAPI(title="Maritime Fusion Grid API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}