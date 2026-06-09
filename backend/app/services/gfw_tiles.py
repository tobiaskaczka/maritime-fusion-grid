from math import atan, degrees, pi, sinh

from mapbox_vector_tile import decode

from app.config import MVT_EXTENT
from app.schemas.gfw import GfwFeature


def get_tile_transformer(z: int, x: int, y: int):
    tile_count = 2**z

    def transform(coordinate_x: float, coordinate_y: float) -> tuple[float, float]:
        # MVT geometry is tile-local. Convert it back to lon/lat so the fusion
        # endpoint can return plain GeoJSON that deck.gl can render directly.
        normalized_x = (x + coordinate_x / MVT_EXTENT) / tile_count
        normalized_y = (y + coordinate_y / MVT_EXTENT) / tile_count
        longitude = normalized_x * 360 - 180
        latitude = degrees(atan(sinh(pi * (1 - 2 * normalized_y))))

        return longitude, latitude

    return transform


def decode_gfw_tile_features(
    tile_bytes: bytes,
    z: int,
    x: int,
    y: int,
) -> list[GfwFeature]:
    if not tile_bytes:
        return []

    tile = decode(
        tile_bytes,
        default_options={
            "geojson": True,
            "y_coord_down": True,
            "transformer": get_tile_transformer(z, x, y),
        },
    )
    features: list[GfwFeature] = []

    for layer in tile.values():
        for feature in layer.get("features", []):
            geometry = feature.get("geometry")
            properties = feature.get("properties", {})

            if isinstance(geometry, dict) and isinstance(properties, dict):
                features.append(
                    {
                        "geometry": geometry,
                        "properties": dict(properties),
                    }
                )

    return features


def get_feature_cell_id(properties: dict[str, object]) -> str | None:
    cell_id = properties.get("id")

    if isinstance(cell_id, str) and len(cell_id.split("/")) == 4:
        return cell_id

    return None


def get_cell_number(cell_id: str) -> int:
    try:
        return int(cell_id.split("/")[-1])
    except ValueError:
        return 0


def get_numeric_property(properties: dict[str, object]) -> float:
    # GFW datasets do not expose the same value field for every layer. Try the
    # known candidates and keep the rest of the fusion logic source-agnostic.
    candidate_keys = [
        "count",
        "detections",
        "hours",
        "value",
        "activityHours",
        "presence",
    ]

    for key in candidate_keys:
        value = properties.get(key)

        if isinstance(value, int | float):
            return float(value)

        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue

    return 1.0


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
