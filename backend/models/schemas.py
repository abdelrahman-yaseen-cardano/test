from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


class VideoNodeData(BaseModel):
    id: str
    name: str
    type: Literal["video"] = "video"
    video_url: str
    first_frame_url: str
    last_frame_url: str
    duration: float          # seconds
    width: int
    height: int


class GroupNodeData(BaseModel):
    id: str
    name: str
    type: Literal["group"] = "group"
    child_ids: list[str]     # ordered list of node IDs
    first_frame_url: str
    last_frame_url: str
    duration: float


class SimilarityResult(BaseModel):
    node_id: str
    side: Literal["left", "right"]   # the handle that IS compatible
    score: float


class CompatibilityResponse(BaseModel):
    query_node_id: str
    query_side: Literal["left", "right"]  # the side the user clicked
    compatible: list[SimilarityResult]


class SimilarityMatrixEntry(BaseModel):
    source_id: str   # last frame owner
    target_id: str   # first frame owner
    score: float


class ExportCycle(BaseModel):
    node_ids: list[str]        # ordered sequence for this cycle
    repeat: int = 1            # how many times to play


class ExportRequest(BaseModel):
    cycles: list[ExportCycle]


class ExportEntry(BaseModel):
    node_id: str
    name: str
    type: str
    video_url: str
    duration: float
    cycle_index: int
    repeat_index: int


class ExportResponse(BaseModel):
    entries: list[ExportEntry]
    total_duration: float
    timeline: list[dict]       # {node_id, name, start, end, cycle_index}
