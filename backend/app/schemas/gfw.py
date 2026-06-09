from typing import Literal, NotRequired, TypedDict

GfwSource = Literal["ais", "sar"]
SarMatchFilter = Literal["all", "matched", "unmatched"]


class GfwFeature(TypedDict):
    geometry: dict[str, object]
    properties: dict[str, object]


class FusionSourceValues(TypedDict):
    fishingAisHours: float
    sarMatchedDetections: float
    sarUnmatchedDetections: float


class FusionReviewAreaProperties(TypedDict):
    cellId: str
    z: int
    x: int
    y: int
    cell: int
    priorityScore: int
    priority: Literal["none", "low", "medium", "high"]
    assessment: str
    fishingAisHours: float
    sarMatchedDetections: float
    sarUnmatchedDetections: float
    sarTotalDetections: float
    unmatchedRatio: float
    analysisStartDate: str
    analysisEndDate: str
    confidence: Literal["low", "medium", "high"]
    reasons: list[str]
    caveats: list[str]
    ais: NotRequired[dict[str, object]]
    sarMatched: NotRequired[dict[str, object]]
    sarUnmatched: NotRequired[dict[str, object]]
