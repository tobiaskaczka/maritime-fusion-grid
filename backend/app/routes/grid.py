from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.fixtures.grid_cells import AIS_GRID_CELLS
from app.fixtures.night_light_detections import NIGHT_LIGHT_DETECTIONS
from app.services.grid_aggregation import aggregate_points_to_grid

router = APIRouter(prefix="/grid", tags=["grid"])


class GridCellProperties(BaseModel):
    id: str
    source: Literal["ais", "night-lights", "radar"]
    score: float = Field(ge=0, le=1)
    detectionCount: int = Field(ge=0)


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]


class GridCell(BaseModel):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: GridCellProperties


@router.get("", response_model=list[GridCell])
def get_grid(
    source: Literal["ais", "night-lights"] = Query(default="ais"),
) -> list[GridCell]:
    if source == "night-lights":
        cells = aggregate_points_to_grid(NIGHT_LIGHT_DETECTIONS, source)
    else:
        cells = AIS_GRID_CELLS

    return [GridCell.model_validate(cell) for cell in cells]
