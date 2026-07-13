import { NextResponse } from "next/server";

import { fetchValueDetail } from "@/lib/server/duckdb-engine";
import type { DateGranularity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      dataset_id?: string;
      primary_column?: string;
      secondary_columns?: string[];
      primary_value?: string;
      segment_key?: string | null;
      selected_values?: Record<string, string[]>;
      date_granularity?: Record<string, DateGranularity>;
      limit?: number;
      offset?: number;
    };

    if (!body.dataset_id || !body.primary_column || body.primary_value == null) {
      return NextResponse.json({ detail: "Missing required fields" }, { status: 400 });
    }

    const result = await fetchValueDetail(
      body.dataset_id,
      body.primary_column,
      body.secondary_columns ?? [],
      body.primary_value,
      body.segment_key ?? null,
      body.selected_values ?? {},
      body.date_granularity ?? {},
      body.limit ?? 100,
      body.offset ?? 0,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detail failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
