import os
from datetime import date, timedelta
from json import loads
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Path, Query, Response
from fastapi.responses import JSONResponse
from mapbox_vector_tile import decode

router = APIRouter(prefix="/gfw", tags=["gfw"])

GFW_TILE_BASE_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/tile/heatmap"
GFW_BINS_BASE_URL = "https://gateway.api.globalfishingwatch.org/v3/4wings/bins"

GfwSource = Literal["ais", "sar"]
SarMatchFilter = Literal["all", "matched", "unmatched"]
GFW_WINDOW_DAYS = 7

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


def get_gfw_request_headers(token: str, accept: str) -> dict[str, str]:
    return {
        "Accept": accept,
        "Authorization": f"Bearer {token}",
        "User-Agent": "maritime-fusion-grid/0.1",
    }


def get_gfw_query(
    source: GfwSource,
    selected_date: date | None,
    extra_params: dict[str, str],
    sar_match_filter: SarMatchFilter = "all",
) -> str:
    source_config = GFW_SOURCE_CONFIG[source]
    query_params = {
        "date-range": get_gfw_date_range(source, selected_date),
        "datasets[0]": os.getenv(
            source_config["dataset_env"],
            source_config["default_dataset"],
        ),
        "interval": os.getenv(
            source_config["interval_env"],
            source_config["default_interval"],
        ),
        **extra_params,
    }

    if source == "sar" and sar_match_filter != "all":
        query_params["filters[0]"] = (
            "matched='true'"
            if sar_match_filter == "matched"
            else "matched='false'"
        )

    return urlencode(query_params)


def request_gfw_tile_bytes(
    source: GfwSource,
    z: int,
    x: int,
    y: int,
    selected_date: date | None,
    sar_match_filter: SarMatchFilter = "all",
) -> bytes:
    token = get_gfw_token()
    query = get_gfw_query(
        source,
        selected_date,
        {
            "format": "MVT",
            "temporal-aggregation": "true",
        },
        sar_match_filter,
    )
    request = Request(
        f"{GFW_TILE_BASE_URL}/{z}/{x}/{y}?{query}",
        headers=get_gfw_request_headers(
            token,
            "application/vnd.mapbox-vector-tile,*/*",
        ),
    )

    try:
        with urlopen(request, timeout=20) as tile_response:
            return tile_response.read()
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")[:500]
        if error.code == 404 and "Tile empty" in error_body:
            return b""

        raise HTTPException(
            status_code=error.code,
            detail=(
                f"GFW {source} tile request failed with status "
                f"{error.code}: {error_body}"
            ),
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail=f"GFW {source} tile request failed: {error.reason}",
        ) from error


def find_tile_cell_properties(
    tile_bytes: bytes,
    z: int,
    x: int,
    y: int,
    cell: int,
) -> dict[str, object] | None:
    if not tile_bytes:
        return None

    tile = decode(tile_bytes)
    cell_id = f"{z}/{x}/{y}/{cell}"

    for layer in tile.values():
        for feature in layer.get("features", []):
            properties = feature.get("properties", {})
            if properties.get("id") == cell_id or properties.get("cell") == cell:
                return dict(properties)

    return None


@router.get("/config")
def get_gfw_config() -> dict[str, object]:
    return {
        "dateRange": get_configured_gfw_date_range(),
        "sources": {
            source: {
                "interval": os.getenv(
                    source_config["interval_env"],
                    source_config["default_interval"],
                ),
                "windowDays": GFW_WINDOW_DAYS,
            }
            for source, source_config in GFW_SOURCE_CONFIG.items()
        },
    }


@router.get("/{source}/tiles/{z}/{x}/{y}.mvt")
def get_gfw_tile(
    source: GfwSource,
    z: int = Path(ge=0, le=12),
    x: int = Path(ge=0),
    y: int = Path(ge=0),
    selected_date: date | None = Query(default=None, alias="date"),
    sar_match_filter: SarMatchFilter = Query(default="all", alias="matched"),
) -> Response:
    tile_bytes = request_gfw_tile_bytes(
        source,
        z,
        x,
        y,
        selected_date,
        sar_match_filter,
    )

    return Response(
        content=tile_bytes,
        media_type="application/vnd.mapbox-vector-tile",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/fusion/cells/{z}/{x}/{y}/{cell}")
def get_gfw_fusion_cell(
    z: int = Path(ge=0, le=12),
    x: int = Path(ge=0),
    y: int = Path(ge=0),
    cell: int = Path(ge=0),
    selected_date: date | None = Query(default=None, alias="date"),
    sar_match_filter: SarMatchFilter = Query(default="all", alias="matched"),
    included_sources: list[GfwSource] = Query(default=["ais", "sar"], alias="include"),
) -> JSONResponse:
    sources: dict[str, dict[str, object]] = {}

    if "ais" in included_sources:
        ais_properties = find_tile_cell_properties(
            request_gfw_tile_bytes("ais", z, x, y, selected_date),
            z,
            x,
            y,
            cell,
        )

        if ais_properties is not None:
            sources["ais"] = ais_properties

    if "sar" in included_sources:
        sar_properties = find_tile_cell_properties(
            request_gfw_tile_bytes("sar", z, x, y, selected_date, sar_match_filter),
            z,
            x,
            y,
            cell,
        )

        if sar_properties is not None:
            sources["sar"] = sar_properties

    return JSONResponse(
        content={
            "cellId": f"{z}/{x}/{y}/{cell}",
            "z": z,
            "x": x,
            "y": y,
            "cell": cell,
            "sources": sources,
        },
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/{source}/bins/{z}")
def get_gfw_bins(
    source: GfwSource,
    z: int = Path(ge=0, le=12),
    selected_date: date | None = Query(default=None, alias="date"),
    sar_match_filter: SarMatchFilter = Query(default="all", alias="matched"),
) -> JSONResponse:
    token = get_gfw_token()
    query = get_gfw_query(
        source,
        selected_date,
        {
            "num-bins": "9",
            "temporal-aggregation": "false",
        },
        sar_match_filter,
    )
    request = Request(
        f"{GFW_BINS_BASE_URL}/{z}?{query}",
        headers=get_gfw_request_headers(token, "application/json,*/*"),
    )

    try:
        with urlopen(request, timeout=20) as bins_response:
            bins_payload = loads(bins_response.read().decode("utf-8"))
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")[:500]
        raise HTTPException(
            status_code=error.code,
            detail=(
                f"GFW {source} bins request failed with status "
                f"{error.code}: {error_body}"
            ),
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=502,
            detail=f"GFW {source} bins request failed: {error.reason}",
        ) from error

    return JSONResponse(
        content=bins_payload,
        headers={"Cache-Control": "public, max-age=3600"},
    )
