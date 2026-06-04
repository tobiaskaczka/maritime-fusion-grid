from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.fixtures.grid_cells import AIS_GRID_CELLS

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
    source: Literal["ais"] = Query(default="ais"),
) -> list[GridCell]:
    return [GridCell.model_validate(cell) for cell in AIS_GRID_CELLS]
