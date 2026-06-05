from collections import defaultdict
from math import floor
from typing import Any, Literal, TypedDict


class PointDetection(TypedDict):
    latitude: float
    longitude: float


class CellAccumulator(TypedDict):
    count: int


def aggregate_points_to_grid(
    detections: list[PointDetection],
    source: Literal["night-lights", "radar"],
    cell_size_degrees: float = 10,
) -> list[dict[str, Any]]:
    cells: dict[tuple[int, int], CellAccumulator] = defaultdict(lambda: {"count": 0})

    for detection in detections:
        column = floor((detection["longitude"] + 180) / cell_size_degrees)
        row = floor((detection["latitude"] + 90) / cell_size_degrees)
        cells[(column, row)]["count"] += 1

    max_count = max((cell["count"] for cell in cells.values()), default=1)
    features: list[dict[str, Any]] = []

    for (column, row), cell in sorted(cells.items()):
        west = column * cell_size_degrees - 180
        south = row * cell_size_degrees - 90
        east = west + cell_size_degrees
        north = south + cell_size_degrees
        detection_count = cell["count"]

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [west, south],
                            [east, south],
                            [east, north],
                            [west, north],
                            [west, south],
                        ]
                    ],
                },
                "properties": {
                    "id": f"{source}-{row}-{column}",
                    "source": source,
                    "score": detection_count / max_count,
                    "detectionCount": detection_count,
                },
            }
        )

    return features
