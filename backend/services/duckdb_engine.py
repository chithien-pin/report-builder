from __future__ import annotations

import json

import duckdb

from services.dataset_registry import load_meta, parquet_path
from services.models import (
    ColumnValueItem,
    ColumnValuesResponse,
    DateGranularity,
    DetailResponse,
    SummaryResponse,
    SummarySegment,
    SummaryTab,
)

GROUP_SEP = " · "
ALL_SEGMENT_KEY = "__all__"


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _escape_literal(value: str) -> str:
    return value.replace("'", "''")


def _value_expression(column: str, dtype: str, granularity: DateGranularity | None) -> str:
    quoted = _quote_identifier(column)
    if dtype == "date" and granularity:
        if granularity == "day":
            return f"strftime(CAST({quoted} AS DATE), '%Y-%m-%d')"
        if granularity == "week":
            return f"strftime(date_trunc('week', CAST({quoted} AS TIMESTAMP)), '%Y-W%V')"
        if granularity == "month":
            return f"strftime(date_trunc('month', CAST({quoted} AS TIMESTAMP)), '%Y-%m')"
    return f"CAST({quoted} AS VARCHAR)"


def _label_expression(value_expr: str) -> str:
    return f"COALESCE(CAST({value_expr} AS VARCHAR), '(trống)')"


def _column_exprs(
    columns: list[str],
    column_types: dict[str, str],
    date_granularity: dict[str, DateGranularity],
) -> tuple[list[str], list[str], list[str]]:
    value_exprs: list[str] = []
    label_exprs: list[str] = []
    group_by_parts: list[str] = []
    for col in columns:
        gran = date_granularity.get(col)
        expr = _value_expression(col, column_types.get(col, "string"), gran)
        label = _label_expression(expr)
        value_exprs.append(expr)
        label_exprs.append(label)
        group_by_parts.append(expr)
    return value_exprs, label_exprs, group_by_parts


def _value_condition(value_expr: str, label_expr: str, value: str) -> str:
    if value == "(trống)":
        return f"({value_expr}) IS NULL"
    safe = _escape_literal(value)
    return f"{label_expr} = '{safe}'"


def _parse_segment_key(segment_key: str, secondary_columns: list[str]) -> list[str]:
    if not secondary_columns or segment_key in {ALL_SEGMENT_KEY, ""}:
        return []
    if len(secondary_columns) == 1:
        return [segment_key]
    return segment_key.split(GROUP_SEP)


def list_column_values(
    dataset_id: str,
    filter_column: str,
    date_granularity: DateGranularity | None = None,
    search: str = "",
    limit: int = 200,
    offset: int = 0,
) -> ColumnValuesResponse:
    meta = load_meta(dataset_id)
    path = parquet_path(dataset_id)
    column_types = {c.name: c.dtype for c in meta.columns}

    if filter_column not in column_types:
        raise ValueError(f"Cột '{filter_column}' không tồn tại trong dataset.")

    dtype = column_types[filter_column]
    value_expr = _value_expression(filter_column, dtype, date_granularity)
    label_expr = _label_expression(value_expr)

    search_clause = ""
    if search.strip():
        safe = _escape_literal(search.strip())
        search_clause = f"WHERE group_label ILIKE '%{safe}%'"

    base_query = f"""
        SELECT
            {label_expr} AS group_key,
            {label_expr} AS group_label,
            COUNT(*) AS row_count
        FROM read_parquet('{path.as_posix()}')
        GROUP BY {value_expr}
    """

    order_clause = "group_label ASC"
    if dtype == "date":
        order_clause = "group_key ASC NULLS LAST"

    conn = duckdb.connect()
    try:
        total = conn.execute(
            f"SELECT COUNT(*) FROM ({base_query}) t {search_clause}"
        ).fetchone()[0]

        rows = conn.execute(
            f"""
            SELECT group_key, group_label, row_count
            FROM ({base_query}) t
            {search_clause}
            ORDER BY {order_clause}
            LIMIT {limit} OFFSET {offset}
            """
        ).fetchall()
    finally:
        conn.close()

    values = [
        ColumnValueItem(key=str(row[0]), label=str(row[1]), row_count=int(row[2]))
        for row in rows
    ]
    return ColumnValuesResponse(values=values, total=int(total), limit=limit, offset=offset)


def compute_summary(
    dataset_id: str,
    primary_column: str,
    secondary_columns: list[str],
    selected_values: dict[str, list[str]],
    sum_columns: list[str],
    date_granularity: dict[str, DateGranularity] | None = None,
) -> SummaryResponse:
    meta = load_meta(dataset_id)
    path = parquet_path(dataset_id)
    column_types = {c.name: c.dtype for c in meta.columns}
    gran = date_granularity or {}
    all_group_cols = [primary_column, *secondary_columns]

    for col in all_group_cols + sum_columns:
        if col not in column_types:
            raise ValueError(f"Cột '{col}' không tồn tại trong dataset.")

    for col in all_group_cols:
        if not selected_values.get(col):
            raise ValueError(f"Cột '{col}' chưa chọn giá trị nào.")

    p_value, p_labels, p_group = _column_exprs([primary_column], column_types, gran)
    primary_label_expr = p_labels[0]
    primary_group_expr = p_group[0]

    sec_labels: list[str] = []
    if secondary_columns:
        _, sec_labels, _ = _column_exprs(secondary_columns, column_types, gran)

    # Nhóm phụ chỉ lọc (WHERE); luôn gom tổng theo nhóm chính (1 segment/tab).
    segment_key_expr = f"'{ALL_SEGMENT_KEY}'"
    segment_label_expr = "'Tổng'"
    group_by_sql = primary_group_expr

    where_parts: list[str] = []
    for i, col in enumerate(all_group_cols):
        if i == 0:
            label_expr = primary_label_expr
        else:
            label_expr = sec_labels[i - 1]
        literals = ", ".join(f"'{_escape_literal(v)}'" for v in selected_values[col])
        where_parts.append(f"{label_expr} IN ({literals})")

    where_sql = " AND ".join(where_parts)
    sum_parts = [
        f'SUM(CAST({_quote_identifier(col)} AS DOUBLE)) AS "{col}"'
        for col in sum_columns
    ]

    order_clause = "tab_key ASC"
    if column_types.get(primary_column) == "date":
        order_clause = "tab_key ASC NULLS LAST"

    query = f"""
        SELECT
            {primary_label_expr} AS tab_key,
            {primary_label_expr} AS tab_label,
            {segment_key_expr} AS segment_key,
            {segment_label_expr} AS segment_label,
            COUNT(*) AS row_count,
            {", ".join(sum_parts)}
        FROM read_parquet('{path.as_posix()}')
        WHERE {where_sql}
        GROUP BY {group_by_sql}
        ORDER BY {order_clause}
    """

    conn = duckdb.connect()
    try:
        rows = conn.execute(query).fetchall()
    finally:
        conn.close()

    tabs_map: dict[str, SummaryTab] = {}
    tab_order: list[str] = []

    for row in rows:
        tab_key = str(row[0])
        tab_label = str(row[1])
        segment_key = str(row[2])
        segment_label = str(row[3])
        row_count = int(row[4])
        values = {sum_columns[i]: row[5 + i] for i in range(len(sum_columns))}

        if tab_key not in tabs_map:
            tabs_map[tab_key] = SummaryTab(
                key=tab_key,
                label=tab_label,
                row_count=0,
                segments=[],
            )
            tab_order.append(tab_key)

        tabs_map[tab_key].row_count += row_count
        tabs_map[tab_key].segments.append(
            SummarySegment(
                key=segment_key,
                label=segment_label if segment_key != ALL_SEGMENT_KEY else "Tổng",
                row_count=row_count,
                values=values,
            )
        )

    tabs = [tabs_map[k] for k in tab_order]
    return SummaryResponse(tabs=tabs, total_tabs=len(tabs))


def fetch_value_detail(
    dataset_id: str,
    primary_column: str,
    secondary_columns: list[str],
    primary_value: str,
    segment_key: str | None = None,
    selected_values: dict[str, list[str]] | None = None,
    date_granularity: dict[str, DateGranularity] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> DetailResponse:
    meta = load_meta(dataset_id)
    path = parquet_path(dataset_id)
    column_types = {c.name: c.dtype for c in meta.columns}
    gran = date_granularity or {}

    p_value, p_labels, _ = _column_exprs([primary_column], column_types, gran)
    conditions = [_value_condition(p_value[0], p_labels[0], primary_value)]

    if secondary_columns and segment_key and segment_key != ALL_SEGMENT_KEY:
        sec_values = _parse_segment_key(segment_key, secondary_columns)
        sec_value, sec_labels, _ = _column_exprs(secondary_columns, column_types, gran)
        for i, col in enumerate(secondary_columns):
            val = sec_values[i] if i < len(sec_values) else ""
            conditions.append(_value_condition(sec_value[i], sec_labels[i], val))
    elif secondary_columns and selected_values:
        _, sec_labels, _ = _column_exprs(secondary_columns, column_types, gran)
        for i, col in enumerate(secondary_columns):
            vals = selected_values.get(col) or []
            if vals:
                literals = ", ".join(f"'{_escape_literal(v)}'" for v in vals)
                conditions.append(f"{sec_labels[i]} IN ({literals})")

    where_sql = " AND ".join(conditions)

    conn = duckdb.connect()
    try:
        total_rows = conn.execute(
            f"SELECT COUNT(*) FROM read_parquet('{path.as_posix()}') WHERE {where_sql}"
        ).fetchone()[0]

        df = conn.execute(
            f"""
            SELECT * FROM read_parquet('{path.as_posix()}')
            WHERE {where_sql}
            LIMIT {limit} OFFSET {offset}
            """
        ).df()
    finally:
        conn.close()

    for col in df.columns:
        if str(df[col].dtype).startswith("datetime"):
            df[col] = df[col].dt.strftime("%Y-%m-%d")

    rows = json.loads(df.to_json(orient="records", date_format="iso"))
    return DetailResponse(
        rows=rows,
        total_rows=int(total_rows),
        limit=limit,
        offset=offset,
    )
