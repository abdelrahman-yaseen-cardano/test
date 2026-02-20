import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from models.schemas import ExportRequest, ExportResponse, ExportEntry

router = APIRouter(prefix="/api/export", tags=["export"])

REGISTRY_FILE = Path("uploads/nodes.json")
GROUPS_FILE = Path("uploads/groups.json")


def _load_registry() -> dict:
    if REGISTRY_FILE.exists():
        return json.loads(REGISTRY_FILE.read_text())
    return {}


def _load_groups() -> dict:
    if GROUPS_FILE.exists():
        return json.loads(GROUPS_FILE.read_text())
    return {}


def _expand_node(node_id: str, registry: dict, groups: dict) -> list[dict]:
    """Recursively expand a group node into its constituent video nodes."""
    if node_id in groups:
        group = groups[node_id]
        expanded = []
        for child_id in group.get("child_ids", []):
            expanded.extend(_expand_node(child_id, registry, groups))
        return expanded
    if node_id in registry:
        return [registry[node_id]]
    return []


@router.post("", response_model=ExportResponse)
async def export_sequence(payload: ExportRequest):
    registry = _load_registry()
    groups = _load_groups()

    entries: list[ExportEntry] = []
    timeline: list[dict] = []
    cursor = 0.0

    for cycle_idx, cycle in enumerate(payload.cycles):
        for repeat_idx in range(cycle.repeat):
            for node_id in cycle.node_ids:
                expanded = _expand_node(node_id, registry, groups)
                if not expanded:
                    raise HTTPException(404, f"Node {node_id!r} not found")
                for node_data in expanded:
                    nid = node_data["id"]
                    dur = float(node_data.get("duration", 0))
                    entries.append(
                        ExportEntry(
                            node_id=nid,
                            name=node_data["name"],
                            type=node_data.get("type", "video"),
                            video_url=node_data["video_url"],
                            duration=dur,
                            cycle_index=cycle_idx,
                            repeat_index=repeat_idx,
                        )
                    )
                    timeline.append(
                        {
                            "node_id": nid,
                            "name": node_data["name"],
                            "start": round(cursor, 4),
                            "end": round(cursor + dur, 4),
                            "cycle_index": cycle_idx,
                            "repeat_index": repeat_idx,
                        }
                    )
                    cursor += dur

    return ExportResponse(
        entries=entries,
        total_duration=round(cursor, 4),
        timeline=timeline,
    )
