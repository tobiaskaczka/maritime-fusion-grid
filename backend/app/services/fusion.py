from concurrent.futures import ThreadPoolExecutor
from datetime import date
from math import log1p
from typing import Literal

from app.config import get_analysis_window
from app.schemas.gfw import FusionReviewAreaProperties, FusionSourceValues
from app.services.gfw_client import request_gfw_tile_bytes
from app.services.gfw_tiles import (
    decode_gfw_tile_features,
    get_cell_number,
    get_feature_cell_id,
    get_numeric_property,
)


def normalize_log(value: float, upper_reference: float) -> float:
    if value <= 0:
        return 0

    # Log scaling keeps large SAR counts from flattening the whole 0-100 score.
    return min(log1p(value) / log1p(upper_reference), 1)


def get_priority(score: int) -> Literal["none", "low", "medium", "high"]:
    if score >= 70:
        return "high"

    if score >= 40:
        return "medium"

    if score > 0:
        return "low"

    return "none"


def get_confidence(
    score: int,
    sar_total_detections: float,
) -> Literal["low", "medium", "high"]:
    if score >= 70 and sar_total_detections >= 5:
        return "high"

    if score >= 40 and sar_total_detections >= 2:
        return "medium"

    return "low"


def get_assessment(
    fishing_ais_hours: float,
    sar_matched_detections: float,
    sar_unmatched_detections: float,
) -> str:
    if (
        sar_unmatched_detections == 0
        and sar_matched_detections > 0
        and fishing_ais_hours > 0
    ):
        return "corroborated-activity"

    if sar_unmatched_detections > 0 and fishing_ais_hours > 0:
        return "fleet-shadow-cue"

    if sar_unmatched_detections > 0 and fishing_ais_hours <= 0:
        return "isolated-dark-cue"

    if sar_unmatched_detections > 0:
        return "unmatched-sar-area"

    return "no-assessment"


def build_fusion_reasons(
    fishing_ais_hours: float,
    sar_matched_detections: float,
    sar_unmatched_detections: float,
    unmatched_ratio: float,
) -> list[str]:
    reasons = [
        f"{sar_unmatched_detections:g} SAR detections are unmatched to AIS.",
        f"Unmatched SAR ratio is {round(unmatched_ratio * 100)}%.",
    ]

    if sar_matched_detections > 0:
        reasons.append(
            f"{sar_matched_detections:g} SAR detections are matched to AIS."
        )

    if fishing_ais_hours > 0:
        reasons.append(
            f"Fishing AIS activity is present in the same grid cell "
            f"({fishing_ais_hours:g} hours)."
        )
        reasons.append(
            "Radar-observed activity is not fully represented by cooperative "
            "fishing activity."
        )
    else:
        reasons.append("Little or no fishing AIS activity is present in this cell.")

    return reasons


def build_fusion_review_properties(
    cell_id: str,
    z: int,
    x: int,
    y: int,
    analysis_start_date: str,
    analysis_end_date: str,
    source_values: FusionSourceValues,
) -> FusionReviewAreaProperties:
    fishing_ais_hours = source_values["fishingAisHours"]
    sar_matched_detections = source_values["sarMatchedDetections"]
    sar_unmatched_detections = source_values["sarUnmatchedDetections"]
    sar_total_detections = sar_matched_detections + sar_unmatched_detections
    unmatched_ratio = (
        sar_unmatched_detections / sar_total_detections
        if sar_total_detections > 0
        else 0
    )

    score = 0

    # This is intentionally a triage score, not a probability. Unmatched SAR
    # drives the priority, while fishing AIS provides context for the cue.
    score += normalize_log(sar_unmatched_detections, 750) * 48
    score += unmatched_ratio * 22

    if sar_unmatched_detections > 0 and fishing_ais_hours > 0:
        score += 9
    elif sar_unmatched_detections > 0:
        score += 6

    score += normalize_log(sar_total_detections, 150) * 8

    if sar_total_detections <= 1:
        score -= 10

    priority_score = round(max(0, min(score, 100)))

    return {
        "cellId": cell_id,
        "z": z,
        "x": x,
        "y": y,
        "cell": get_cell_number(cell_id),
        "priorityScore": priority_score,
        "priority": get_priority(priority_score),
        "assessment": get_assessment(
            fishing_ais_hours,
            sar_matched_detections,
            sar_unmatched_detections,
        ),
        "fishingAisHours": fishing_ais_hours,
        "sarMatchedDetections": sar_matched_detections,
        "sarUnmatchedDetections": sar_unmatched_detections,
        "sarTotalDetections": sar_total_detections,
        "unmatchedRatio": unmatched_ratio,
        "analysisStartDate": analysis_start_date,
        "analysisEndDate": analysis_end_date,
        "confidence": get_confidence(priority_score, sar_total_detections),
        "reasons": build_fusion_reasons(
            fishing_ais_hours,
            sar_matched_detections,
            sar_unmatched_detections,
            unmatched_ratio,
        ),
        "caveats": [
            "Unmatched SAR does not prove illicit activity.",
            "SAR coverage is episodic, not continuous.",
            "Fishing AIS is cooperative and incomplete.",
            "This is a review cue, not a final determination.",
        ],
    }


def build_fusion_tile_features(
    z: int,
    x: int,
    y: int,
    selected_date: date | None,
) -> list[dict[str, object]]:
    analysis_start_date, analysis_end_date = get_analysis_window(selected_date)

    # Build the derived review layer from the same tile/cell ids as the raw
    # source layers. Fetch the three upstream source tiles in parallel because
    # production latency is dominated by network round trips, not local math.
    with ThreadPoolExecutor(max_workers=3) as executor:
        ais_tile = executor.submit(
            request_gfw_tile_bytes,
            "ais",
            z,
            x,
            y,
            selected_date,
        )
        sar_matched_tile = executor.submit(
            request_gfw_tile_bytes,
            "sar",
            z,
            x,
            y,
            selected_date,
            "matched",
        )
        sar_unmatched_tile = executor.submit(
            request_gfw_tile_bytes,
            "sar",
            z,
            x,
            y,
            selected_date,
            "unmatched",
        )

        ais_features = decode_gfw_tile_features(ais_tile.result(), z, x, y)
        sar_matched_features = decode_gfw_tile_features(
            sar_matched_tile.result(),
            z,
            x,
            y,
        )
        sar_unmatched_features = decode_gfw_tile_features(
            sar_unmatched_tile.result(),
            z,
            x,
            y,
        )
    cells: dict[str, dict[str, object]] = {}

    # Merge source evidence by cell id. Geometry can come from any contributing
    # source because the cell boundary is shared for a given z/x/y/cell.
    for feature in ais_features:
        cell_id = get_feature_cell_id(feature["properties"])

        if cell_id is None:
            continue

        cell = cells.setdefault(cell_id, {})
        cell["geometry"] = feature["geometry"]
        cell["ais"] = feature["properties"]

    for feature in sar_matched_features:
        cell_id = get_feature_cell_id(feature["properties"])

        if cell_id is None:
            continue

        cell = cells.setdefault(cell_id, {})
        cell["geometry"] = feature["geometry"]
        cell["sarMatched"] = feature["properties"]

    for feature in sar_unmatched_features:
        cell_id = get_feature_cell_id(feature["properties"])

        if cell_id is None:
            continue

        cell = cells.setdefault(cell_id, {})
        cell["geometry"] = feature["geometry"]
        cell["sarUnmatched"] = feature["properties"]

    features: list[dict[str, object]] = []

    for cell_id, cell in cells.items():
        geometry = cell.get("geometry")

        if not isinstance(geometry, dict):
            continue

        ais_properties = cell.get("ais")
        sar_matched_properties = cell.get("sarMatched")
        sar_unmatched_properties = cell.get("sarUnmatched")
        fishing_ais_hours = (
            get_numeric_property(ais_properties)
            if isinstance(ais_properties, dict)
            else 0
        )
        sar_matched_detections = (
            get_numeric_property(sar_matched_properties)
            if isinstance(sar_matched_properties, dict)
            else 0
        )
        sar_unmatched_detections = (
            get_numeric_property(sar_unmatched_properties)
            if isinstance(sar_unmatched_properties, dict)
            else 0
        )
        properties = build_fusion_review_properties(
            cell_id,
            z,
            x,
            y,
            analysis_start_date,
            analysis_end_date,
            {
                "fishingAisHours": fishing_ais_hours,
                "sarMatchedDetections": sar_matched_detections,
                "sarUnmatchedDetections": sar_unmatched_detections,
            },
        )

        if properties["priorityScore"] == 0:
            continue

        # Keep the raw upstream properties attached for explainability. The UI
        # shows the derived fields first and can still inspect source evidence.
        if isinstance(ais_properties, dict):
            properties["ais"] = ais_properties

        if isinstance(sar_matched_properties, dict):
            properties["sarMatched"] = sar_matched_properties

        if isinstance(sar_unmatched_properties, dict):
            properties["sarUnmatched"] = sar_unmatched_properties

        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": properties,
            }
        )

    features.sort(
        key=lambda feature: (
            feature["properties"]["priorityScore"]
            if isinstance(feature.get("properties"), dict)
            else 0
        ),
        reverse=True,
    )

    return features
