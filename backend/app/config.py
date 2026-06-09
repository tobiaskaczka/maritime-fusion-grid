import os
from datetime import date, timedelta

from fastapi import HTTPException

from app.schemas.gfw import GfwSource

GFW_TILE_BASE_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/tile/heatmap"
GFW_BINS_BASE_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/bins"

# The UI treats a selected date as a rolling window. The upstream API
# expects an exclusive end date, so the request range is start through date + 1.
GFW_WINDOW_DAYS = 7
MVT_EXTENT = 4096

GFW_SOURCE_CONFIG = {
    "ais": {
        "dataset_env": "GFW_AIS_DATASET",
        "default_dataset": "public-global-fishing-effort:latest",
        "interval_env": "GFW_AIS_INTERVAL",
        "default_interval": "DAY",
    },
    "sar": {
        "dataset_env": "GFW_SAR_DATASET",
        "default_dataset": "public-global-sar-presence:latest",
        "interval_env": "GFW_SAR_INTERVAL",
        "default_interval": "DAY",
    },
}


def get_gfw_token() -> str:
    token = os.getenv("GFW_API_TOKEN")

    if not token:
        raise HTTPException(
            status_code=503,
            detail="GFW_API_TOKEN is not configured on the backend.",
        )

    return token


def get_gfw_date_range(source: GfwSource, selected_date: date | None) -> str:
    if selected_date is not None:
        start_date = selected_date - timedelta(days=GFW_WINDOW_DAYS - 1)
        return f"{start_date},{selected_date + timedelta(days=1)}"

    return os.getenv(
        "GFW_DATE_RANGE",
        os.getenv("GFW_AIS_DATE_RANGE", "2023-05-01,2023-10-20"),
    )


def get_configured_gfw_date_range() -> dict[str, str]:
    date_range = get_gfw_date_range("ais", None)
    try:
        start_date, end_date = [
            value.strip() for value in date_range.split(",", maxsplit=1)
        ]
        date.fromisoformat(start_date)
        date.fromisoformat(end_date)
    except ValueError as error:
        raise HTTPException(
            status_code=500,
            detail="GFW_DATE_RANGE must use YYYY-MM-DD,YYYY-MM-DD.",
        ) from error

    return {"start": start_date, "end": end_date}


def get_analysis_window(selected_date: date | None) -> tuple[str, str]:
    date_range = get_gfw_date_range("ais", selected_date)
    try:
        start_date, end_date = [
            value.strip() for value in date_range.split(",", maxsplit=1)
        ]
    except ValueError as error:
        raise HTTPException(
            status_code=500,
            detail="GFW date range must use YYYY-MM-DD,YYYY-MM-DD.",
        ) from error

    return start_date, end_date


def get_source_dataset(source: GfwSource) -> str:
    source_config = GFW_SOURCE_CONFIG[source]

    return os.getenv(
        source_config["dataset_env"],
        source_config["default_dataset"],
    )


def get_source_interval(source: GfwSource) -> str:
    source_config = GFW_SOURCE_CONFIG[source]

    return os.getenv(
        source_config["interval_env"],
        source_config["default_interval"],
    )
