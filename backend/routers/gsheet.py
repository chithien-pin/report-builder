from fastapi import APIRouter, HTTPException

from services.file_parser import ingest_csv_text
from services.google_sheets import fetch_public_sheet_csv
from services.models import GSheetRequest, UploadResponse

router = APIRouter(prefix="/api", tags=["gsheet"])


@router.post("/gsheet", response_model=UploadResponse)
async def import_gsheet(body: GSheetRequest) -> UploadResponse:
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        csv_text = await fetch_public_sheet_csv(url)
        dataset_id, meta, preview = ingest_csv_text(csv_text, filename="google_sheet.csv")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import sheet: {exc}") from exc

    return UploadResponse(dataset_id=dataset_id, meta=meta, preview=preview)
