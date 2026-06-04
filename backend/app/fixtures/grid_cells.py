from typing import Any


def create_cell(
    cell_id: str,
    west: float,
    south: float,
    east: float,
    north: float,
    score: float,
    detection_count: int,
) -> dict[str, Any]:
    return {
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
            "id": cell_id,
            "source": "ais",
            "score": score,
            "detectionCount": detection_count,
        },
    }


AIS_GRID_CELLS = [
    create_cell("ais-north-atlantic-1", -46, 38, -36, 46, 0.25, 18),
    create_cell("ais-north-atlantic-2", -36, 38, -26, 46, 0.48, 41),
    create_cell("ais-north-atlantic-3", -26, 38, -16, 46, 0.78, 82),
    create_cell("ais-mediterranean-1", 4, 32, 14, 40, 0.92, 127),
    create_cell("ais-indian-ocean-1", 66, -4, 76, 4, 0.36, 29),
    create_cell("ais-south-china-sea-1", 108, 8, 118, 16, 0.69, 73),
    create_cell("ais-east-china-sea-1", 122, 24, 132, 32, 1, 156),
    create_cell("ais-north-pacific-1", -176, 34, -166, 42, 0.56, 52),
]
