from pathlib import Path
import uuid
import json
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from models.schemas import VideoNodeData
from services import frame_extractor, similarity_service

router = APIRouter(prefix="/api/videos", tags=["videos"])

UPLOADS_DIR = Path("uploads/videos")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Persistent node registry: { node_id: VideoNodeData dict }
REGISTRY_FILE = Path("uploads/nodes.json")


def _load_registry() -> dict:
    if REGISTRY_FILE.exists():
        return json.loads(REGISTRY_FILE.read_text())
    return {}


def _save_registry(reg: dict) -> None:
    REGISTRY_FILE.write_text(json.dumps(reg, default=str))


def warm_similarity_cache() -> None:
    """On startup, reload frame arrays for all registered nodes."""
    reg = _load_registry()
    for node_id, data in reg.items():
        similarity_service.reload_frame_cache(
            node_id, data["first_frame_path"], data["last_frame_path"]
        )


@router.get("", response_model=list[VideoNodeData])
async def list_nodes():
    reg = _load_registry()
    return list(reg.values())


@router.post("", response_model=list[VideoNodeData])
async def upload_videos(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    reg = _load_registry()
    created: list[VideoNodeData] = []

    for upload in files:
        node_id = str(uuid.uuid4())
        suffix = Path(upload.filename).suffix.lower() or ".mp4"
        video_path = UPLOADS_DIR / f"{node_id}{suffix}"

        with video_path.open("wb") as f:
            shutil.copyfileobj(upload.file, f)

        try:
            meta = frame_extractor.extract_frames(str(video_path), node_id)
        except Exception as exc:
            video_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc))

        node = VideoNodeData(
            id=node_id,
            name=Path(upload.filename).stem,
            video_url=f"/uploads/videos/{video_path.name}",
            first_frame_url=f"/uploads/frames/{node_id}_first.jpg",
            last_frame_url=f"/uploads/frames/{node_id}_last.jpg",
            duration=meta["duration"],
            width=meta["width"],
            height=meta["height"],
        )

        reg[node_id] = {**node.model_dump(), **meta}
        created.append(node)

    _save_registry(reg)

    # Register in similarity service (may be slow — run for each in turn)
    for c in created:
        data = reg[c.id]
        similarity_service.register_node(c.id, data["first_frame_path"], data["last_frame_path"])

    return created


@router.patch("/{node_id}/rename", response_model=VideoNodeData)
async def rename_node(node_id: str, payload: dict):
    reg = _load_registry()
    if node_id not in reg:
        raise HTTPException(404, "Node not found")
    reg[node_id]["name"] = payload.get("name", reg[node_id]["name"])
    _save_registry(reg)
    return reg[node_id]


@router.delete("/{node_id}", status_code=204)
async def delete_node(node_id: str):
    reg = _load_registry()
    if node_id not in reg:
        raise HTTPException(404, "Node not found")
    data = reg.pop(node_id)
    _save_registry(reg)
    similarity_service.remove_node(node_id)
    # Clean up files
    Path(data.get("first_frame_path", "")).unlink(missing_ok=True)
    Path(data.get("last_frame_path", "")).unlink(missing_ok=True)
    video_file = UPLOADS_DIR / Path(data["video_url"]).name
    video_file.unlink(missing_ok=True)
