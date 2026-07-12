from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ColumnDtype = Literal["string", "number", "float", "date", "boolean"]
DateGranularity = Literal["day", "week", "month"]


class ColumnInfo(BaseModel):
    name: str
    dtype: ColumnDtype
    original_name: str


class DatasetMeta(BaseModel):
    dataset_id: str
    filename: str
    row_count: int
    column_count: int
    columns: list[ColumnInfo]
    created_at: datetime
    sheet: str | None = None


class UploadResponse(BaseModel):
    dataset_id: str
    meta: DatasetMeta
    preview: list[dict[str, Any]]


class GSheetRequest(BaseModel):
    url: str


class ColumnValuesRequest(BaseModel):
    dataset_id: str
    filter_column: str
    date_granularity: DateGranularity | None = None
    search: str = ""
    limit: int = Field(default=200, ge=1, le=2000)
    offset: int = Field(default=0, ge=0)


class ColumnValueItem(BaseModel):
    key: str
    label: str
    row_count: int


class ColumnValuesResponse(BaseModel):
    values: list[ColumnValueItem]
    total: int
    limit: int
    offset: int


class SummaryRequest(BaseModel):
    dataset_id: str
    primary_column: str
    secondary_columns: list[str] = Field(default_factory=list)
    selected_values: dict[str, list[str]]
    sum_columns: list[str] = Field(min_length=1)
    date_granularity: dict[str, DateGranularity] = Field(default_factory=dict)


class SummarySegment(BaseModel):
    key: str
    label: str
    values: dict[str, float | None]
    row_count: int


class SummaryTab(BaseModel):
    key: str
    label: str
    row_count: int
    segments: list[SummarySegment]


class SummaryResponse(BaseModel):
    tabs: list[SummaryTab]
    total_tabs: int


class DetailRequest(BaseModel):
    dataset_id: str
    primary_column: str
    secondary_columns: list[str] = Field(default_factory=list)
    primary_value: str
    segment_key: str | None = None
    selected_values: dict[str, list[str]] = Field(default_factory=dict)
    date_granularity: dict[str, DateGranularity] = Field(default_factory=dict)
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


class DetailResponse(BaseModel):
    rows: list[dict[str, Any]]
    total_rows: int
    limit: int
    offset: int
