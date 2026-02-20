from fastapi import APIRouter, Query
from models.schemas import CompatibilityResponse, SimilarityResult
from services import similarity_service

router = APIRouter(prefix="/api/similarity", tags=["similarity"])

DEFAULT_THRESHOLD = 0.75


@router.get("/compatible/{node_id}", response_model=CompatibilityResponse)
async def get_compatible(
    node_id: str,
    side: str = Query(..., description="'left' or 'right' — the handle that was clicked"),
    threshold: float = Query(DEFAULT_THRESHOLD, ge=0.0, le=1.0),
):
    """
    When the user clicks a knob:
    - clicked RIGHT knob (last-frame side): find nodes whose first frame matches
    - clicked LEFT knob (first-frame side): find nodes whose last frame matches

    Returns compatible handles to highlight.
    """
    if side == "right":
        # source's last frame → find compatible first frames
        raw = similarity_service.get_compatible_targets(node_id, threshold)
    else:
        # target's first frame ← find compatible last frames
        raw = similarity_service.get_compatible_sources(node_id, threshold)

    compatible = [
        SimilarityResult(node_id=r["node_id"], side=r["side"], score=r["score"])
        for r in raw
    ]

    return CompatibilityResponse(
        query_node_id=node_id,
        query_side=side,
        compatible=compatible,
    )


@router.get("/matrix")
async def get_matrix():
    """Return full pairwise similarity matrix for debugging / client-side caching."""
    return similarity_service.get_full_matrix()
