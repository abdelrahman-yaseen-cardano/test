import json
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/groups", tags=["groups"])

REGISTRY_FILE = Path("uploads/nodes.json")
GROUPS_FILE = Path("uploads/groups.json")


class CreateGroupPayload(BaseModel):
    name: str
    child_ids: list[str]          # ordered, the caller guarantees edge connectivity
    first_frame_url: str          # client provides, pulled from first child
    last_frame_url: str           # client provides, pulled from last child
    duration: float


def _load_registry() -> dict:
    if REGISTRY_FILE.exists():
        return json.loads(REGISTRY_FILE.read_text())
    return {}


def _load_groups() -> dict:
    if GROUPS_FILE.exists():
        return json.loads(GROUPS_FILE.read_text())
    return {}


def _save_groups(g: dict) -> None:
    GROUPS_FILE.write_text(json.dumps(g, default=str))


@router.get("")
async def list_groups():
    return list(_load_groups().values())


@router.post("")
async def create_group(payload: CreateGroupPayload):
    if not payload.child_ids:
        raise HTTPException(400, "child_ids cannot be empty")
    groups = _load_groups()
    group_id = str(uuid.uuid4())
    entry = {
        "id": group_id,
        "name": payload.name,
        "type": "group",
        "child_ids": payload.child_ids,
        "first_frame_url": payload.first_frame_url,
        "last_frame_url": payload.last_frame_url,
        "duration": payload.duration,
    }
    groups[group_id] = entry
    _save_groups(groups)
    return entry


@router.patch("/{group_id}/rename")
async def rename_group(group_id: str, payload: dict):
    groups = _load_groups()
    if group_id not in groups:
        raise HTTPException(404, "Group not found")
    groups[group_id]["name"] = payload.get("name", groups[group_id]["name"])
    _save_groups(groups)
    return groups[group_id]


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: str):
    groups = _load_groups()
    if group_id not in groups:
        raise HTTPException(404, "Group not found")
    groups.pop(group_id)
    _save_groups(groups)
