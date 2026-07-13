import { NextResponse } from "next/server";

import { computeSummary } from "@/lib/server/duckdb-engine";
import type { DateGranularity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      dataset_id?: string;
      primary_column?: string;
      secondary_columns?: string[];
      selected_values?: Record<string, string[]>;
      sum_columns?: string[];
      date_granularity?: Record<string, DateGranularity>;
    };

    if (!body.dataset_id || !body.primary_column || !body.sum_columns?.length) {
      return NextResponse.json({ detail: "Missing required fields" }, { status: 400 });
    }

    const result = await computeSummary(
      body.dataset_id,
      body.primary_column,
      body.secondary_columns ?? [],
      body.selected_values ?? {},
      body.sum_columns,
      body.date_granularity ?? {},
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summary failed";
    const status =
      message.includes("chưa chọn") || message.includes("không tồn tại") ? 400 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
