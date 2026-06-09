from datetime import date

from fastapi import APIRouter, Path, Query, Response
from fastapi.responses import JSONResponse

from app.config import (
    GFW_SOURCE_CONFIG,
    GFW_WINDOW_DAYS,
    get_configured_gfw_date_range,
    get_source_interval,
)
from app.schemas.gfw import GfwSource, SarMatchFilter
from app.services.fusion import build_fusion_tile_features
from app.services.gfw_client import request_gfw_bins, request_gfw_tile_bytes
from app.services.gfw_tiles import find_tile_cell_properties

router = APIRouter(prefix="/gfw", tags=["gfw"])


@router.get("/config")
def get_gfw_config() -> dict[str, object]:
    return {
        "dateRange": get_configured_gfw_date_range(),
        "sources": {
            source: {
                "interval": get_source_interval(source),
                "windowDays": GFW_WINDOW_DAYS,
            }
            for source in GFW_SOURCE_CONFIG
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


@router.get("/fusion/tiles/{z}/{x}/{y}")
def get_gfw_fusion_tile(
    z: int = Path(ge=0, le=12),
    x: int = Path(ge=0),
    y: int = Path(ge=0),
    selected_date: date | None = Query(default=None, alias="date"),
    score_version: int = Query(default=2, alias="scoreVersion"),
) -> JSONResponse:
    _ = score_version
    features = build_fusion_tile_features(z, x, y, selected_date)

    return JSONResponse(
        content={
            "type": "FeatureCollection",
            "features": features,
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
    bins_payload = request_gfw_bins(source, z, selected_date, sar_match_filter)

    return JSONResponse(
        content=bins_payload,
        headers={"Cache-Control": "public, max-age=3600"},
    )
