from datetime import date
from json import loads
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.config import (
    GFW_BINS_BASE_URL,
    GFW_TILE_BASE_URL,
    get_gfw_date_range,
    get_gfw_token,
    get_source_dataset,
    get_source_interval,
)
from app.schemas.gfw import GfwSource, SarMatchFilter


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
    query_params = {
        "date-range": get_gfw_date_range(source, selected_date),
        "datasets[0]": get_source_dataset(source),
        "interval": get_source_interval(source),
        **extra_params,
    }

    # The upstream SAR layer already knows whether detections are matched to AIS.
    # We use that status as an input instead of trying to build our own matcher.
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

        # Empty ocean tiles are a normal result for sparse datasets. Treat them
        # as empty data, not as an application error.
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


def request_gfw_bins(
    source: GfwSource,
    z: int,
    selected_date: date | None,
    sar_match_filter: SarMatchFilter = "all",
) -> object:
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
            return loads(bins_response.read().decode("utf-8"))
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
