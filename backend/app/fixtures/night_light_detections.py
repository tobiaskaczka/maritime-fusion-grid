from typing import TypedDict


class NightLightDetection(TypedDict):
    id: str
    latitude: float
    longitude: float
    quality_flag: int
    radiance: float


# Sample records from VIIRS Boat Detection:
# location, quality flag, and brightness/radiance.
NIGHT_LIGHT_DETECTIONS: list[NightLightDetection] = [
    {
        "id": "vbd-sample-west-africa-1",
        "latitude": 4.2,
        "longitude": -18.4,
        "quality_flag": 1,
        "radiance": 7.8,
    },
    {
        "id": "vbd-sample-west-africa-2",
        "latitude": 1.6,
        "longitude": -15.1,
        "quality_flag": 2,
        "radiance": 4.1,
    },
    {
        "id": "vbd-sample-west-africa-3",
        "latitude": -2.4,
        "longitude": -12.2,
        "quality_flag": 1,
        "radiance": 9.6,
    },
    {
        "id": "vbd-sample-arabian-sea-1",
        "latitude": 18.3,
        "longitude": 64.5,
        "quality_flag": 1,
        "radiance": 8.7,
    },
    {
        "id": "vbd-sample-arabian-sea-2",
        "latitude": 15.8,
        "longitude": 66.8,
        "quality_flag": 3,
        "radiance": 3.5,
    },
    {
        "id": "vbd-sample-bay-of-bengal-1",
        "latitude": 12.1,
        "longitude": 87.4,
        "quality_flag": 1,
        "radiance": 6.9,
    },
    {
        "id": "vbd-sample-bay-of-bengal-2",
        "latitude": 14.9,
        "longitude": 89.2,
        "quality_flag": 1,
        "radiance": 11.4,
    },
    {
        "id": "vbd-sample-south-china-sea-1",
        "latitude": 12.6,
        "longitude": 113.7,
        "quality_flag": 1,
        "radiance": 8.1,
    },
    {
        "id": "vbd-sample-south-china-sea-2",
        "latitude": 10.9,
        "longitude": 116.2,
        "quality_flag": 2,
        "radiance": 5.4,
    },
    {
        "id": "vbd-sample-east-china-sea-1",
        "latitude": 28.7,
        "longitude": 125.6,
        "quality_flag": 1,
        "radiance": 10.2,
    },
    {
        "id": "vbd-sample-east-china-sea-2",
        "latitude": 30.1,
        "longitude": 127.4,
        "quality_flag": 1,
        "radiance": 12.9,
    },
    {
        "id": "vbd-sample-east-china-sea-3",
        "latitude": 26.5,
        "longitude": 128.8,
        "quality_flag": 2,
        "radiance": 5.8,
    },
]
