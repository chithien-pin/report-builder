from fastapi import APIRouter, File, HTTPException, UploadFile

from services.dataset_registry import load_meta
from services.file_parser import PREVIEW_ROWS, ingest_bytes
from services.models import UploadResponse

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        dataset_id, meta, preview = ingest_bytes(content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {exc}") from exc

    return UploadResponse(dataset_id=dataset_id, meta=meta, preview=preview)


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str) -> dict:
    try:
        meta = load_meta(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"meta": meta}
