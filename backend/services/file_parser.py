from __future__ import annotations

import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd

from services.dataset_registry import parquet_path, save_meta
from services.models import ColumnDtype, ColumnInfo, DatasetMeta

PREVIEW_ROWS = 20
DATE_PATTERNS = [
    r"^\d{4}-\d{2}-\d{2}",
    r"^\d{2}/\d{2}/\d{4}",
    r"^\d{2}-\d{2}-\d{4}",
]
DATE_COLUMN_HINTS = {"date", "ngay", "ngày", "time", "created", "updated", "day"}


def _normalize_column_name(name: str, index: int) -> str:
    cleaned = str(name).strip()
    if not cleaned or cleaned.lower().startswith("unnamed"):
        return f"column_{index + 1}"
    return cleaned


def _looks_like_date_series(series: pd.Series) -> bool:
    if series.dtype == "datetime64[ns]":
        return True
    sample = series.dropna().astype(str).head(50)
    if sample.empty:
        return False
    parsed = pd.to_datetime(sample, errors="coerce")
    ratio = parsed.notna().mean()
    if ratio >= 0.8:
        return True
    hint = str(series.name).lower()
    return any(token in hint for token in DATE_COLUMN_HINTS)


def _looks_like_number_series(series: pd.Series) -> bool:
    if pd.api.types.is_numeric_dtype(series):
        return True
    sample = series.dropna().astype(str).head(50)
    if sample.empty:
        return False
    normalized = sample.str.replace(",", "", regex=False).str.replace(" ", "", regex=False)
    numeric = pd.to_numeric(normalized, errors="coerce")
    return numeric.notna().mean() >= 0.8


def _detect_dtype(series: pd.Series) -> ColumnDtype:
    if _looks_like_date_series(series):
        return "date"
    if _looks_like_number_series(series):
        if pd.api.types.is_float_dtype(series) or (
            series.dropna().astype(str).str.contains(r"\.", regex=True).any()
        ):
            return "float"
        return "number"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    return "string"


def _coerce_frame(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame.columns = [_normalize_column_name(str(col), i) for i, col in enumerate(frame.columns)]

    for col in frame.columns:
        dtype = _detect_dtype(frame[col])
        if dtype == "date":
            frame[col] = pd.to_datetime(frame[col], errors="coerce")
        elif dtype in {"number", "float"}:
            as_str = frame[col].astype(str).str.replace(",", "", regex=False)
            frame[col] = pd.to_numeric(as_str, errors="coerce")
    return frame


def _build_columns(frame: pd.DataFrame, original_columns: list[str]) -> list[ColumnInfo]:
    columns: list[ColumnInfo] = []
    for i, col in enumerate(frame.columns):
        original = original_columns[i] if i < len(original_columns) else str(col)
        columns.append(
            ColumnInfo(
                name=str(col),
                dtype=_detect_dtype(frame[col]),
                original_name=str(original).strip() or str(col),
            )
        )
    return columns


def _preview_records(frame: pd.DataFrame, limit: int = PREVIEW_ROWS) -> list[dict[str, Any]]:
    preview = frame.head(limit).copy()
    for col in preview.columns:
        if pd.api.types.is_datetime64_any_dtype(preview[col]):
            preview[col] = preview[col].dt.strftime("%Y-%m-%d")
    preview = preview.where(preview.notna(), None)
    return preview.to_dict(orient="records")


def read_uploaded_file(content: bytes, filename: str, sheet: str | None = None) -> tuple[pd.DataFrame, str | None]:
    lower = filename.lower()
    if lower.endswith(".csv"):
        for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                return pd.read_csv(BytesIO(content), encoding=encoding), None
            except UnicodeDecodeError:
                continue
        return pd.read_csv(BytesIO(content), encoding="utf-8", errors="replace"), None

    if lower.endswith((".xlsx", ".xls")):
        excel = pd.ExcelFile(BytesIO(content))
        target_sheet = sheet or excel.sheet_names[0]
        return pd.read_excel(excel, sheet_name=target_sheet), target_sheet

    raise ValueError("Unsupported file type. Use CSV or XLSX.")


def ingest_dataframe(
    frame: pd.DataFrame,
    filename: str,
    sheet: str | None = None,
    original_columns: list[str] | None = None,
) -> tuple[str, DatasetMeta, list[dict[str, Any]]]:
    original = original_columns or [str(c) for c in frame.columns]
    coerced = _coerce_frame(frame)
    dataset_id = str(uuid.uuid4())

    meta = DatasetMeta(
        dataset_id=dataset_id,
        filename=filename,
        row_count=len(coerced),
        column_count=len(coerced.columns),
        columns=_build_columns(coerced, original),
        created_at=datetime.utcnow(),
        sheet=sheet,
    )

    coerced.to_parquet(parquet_path(dataset_id), index=False)
    save_meta(meta)
    return dataset_id, meta, _preview_records(coerced)


def ingest_bytes(content: bytes, filename: str, sheet: str | None = None) -> tuple[str, DatasetMeta, list[dict[str, Any]]]:
    frame, used_sheet = read_uploaded_file(content, filename, sheet)
    return ingest_dataframe(frame, filename, used_sheet, [str(c) for c in frame.columns])


def ingest_csv_text(text: str, filename: str = "google_sheet.csv") -> tuple[str, DatasetMeta, list[dict[str, Any]]]:
    frame = pd.read_csv(BytesIO(text.encode("utf-8")))
    return ingest_dataframe(frame, filename, None, [str(c) for c in frame.columns])
