import { NextResponse } from "next/server";

import { listColumnValues } from "@/lib/server/duckdb-engine";
import type { DateGranularity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      dataset_id?: string;
      filter_column?: string;
      date_granularity?: DateGranularity | null;
      search?: string;
      limit?: number;
      offset?: number;
    };

    if (!body.dataset_id || !body.filter_column) {
      return NextResponse.json({ detail: "Missing dataset_id or filter_column" }, { status: 400 });
    }

    const result = await listColumnValues(
      body.dataset_id,
      body.filter_column,
      body.date_granularity ?? null,
      body.search ?? "",
      body.limit ?? 200,
      body.offset ?? 0,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Values failed";
    const status = message.includes("không tồn tại")
      ? 400
      : message.includes("BLOB_STORE_ID_READ_WRITE_TOKEN")
        ? 503
        : message.includes("not found")
          ? 410
          : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
