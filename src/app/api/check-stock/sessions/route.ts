import { listSessions } from "@/lib/check-stock/server/store";
import { fail, json } from "@/lib/check-stock/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json({ items: await listSessions() });
  } catch (error) {
    return fail(error);
  }
}
