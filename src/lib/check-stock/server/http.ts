import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Lỗi máy chủ.";
  return json({ error: message }, 500);
}
