from fastapi import APIRouter, HTTPException

from services.duckdb_engine import compute_summary, fetch_value_detail, list_column_values
from services.models import (
    ColumnValuesRequest,
    ColumnValuesResponse,
    DetailRequest,
    DetailResponse,
    SummaryRequest,
    SummaryResponse,
)

router = APIRouter(prefix="/api", tags=["summary"])


@router.post("/values", response_model=ColumnValuesResponse)
async def get_column_values(body: ColumnValuesRequest) -> ColumnValuesResponse:
    try:
        return list_column_values(
            dataset_id=body.dataset_id,
            filter_column=body.filter_column,
            date_granularity=body.date_granularity,
            search=body.search,
            limit=body.limit,
            offset=body.offset,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Values failed: {exc}") from exc


@router.post("/summary", response_model=SummaryResponse)
async def get_summary(body: SummaryRequest) -> SummaryResponse:
    try:
        return compute_summary(
            dataset_id=body.dataset_id,
            primary_column=body.primary_column,
            secondary_columns=body.secondary_columns,
            selected_values=body.selected_values,
            sum_columns=body.sum_columns,
            date_granularity=body.date_granularity,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Summary failed: {exc}") from exc


@router.post("/detail", response_model=DetailResponse)
async def get_detail(body: DetailRequest) -> DetailResponse:
    try:
        return fetch_value_detail(
            dataset_id=body.dataset_id,
            primary_column=body.primary_column,
            secondary_columns=body.secondary_columns,
            primary_value=body.primary_value,
            segment_key=body.segment_key,
            selected_values=body.selected_values,
            date_granularity=body.date_granularity,
            limit=body.limit,
            offset=body.offset,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detail failed: {exc}") from exc
