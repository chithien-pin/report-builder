import { parse as parseUrl } from "url";

const EXPORT_BASE = "https://docs.google.com/spreadsheets/d/{sheet_id}/export";

function extractSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractGid(url: string): string | null {
  const parsed = parseUrl(url, true);
  const queryGid = parsed.query?.gid;
  if (queryGid) return String(Array.isArray(queryGid) ? queryGid[0] : queryGid);
  const fragment = parsed.hash ?? "";
  if (fragment.includes("gid=")) {
    return fragment.split("gid=")[1]?.split("&")[0] ?? null;
  }
  return null;
}

export function toCsvExportUrl(url: string): string {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw new Error("Không nhận diện được link Google Sheets hợp lệ.");
  }
  const gid = extractGid(url);
  let exportUrl = EXPORT_BASE.replace("{sheet_id}", sheetId) + "?format=csv";
  if (gid) exportUrl += `&gid=${gid}`;
  return exportUrl;
}

export async function fetchPublicSheetCsv(url: string): Promise<string> {
  const exportUrl = toCsvExportUrl(url);
  const response = await fetch(exportUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      "Không tải được Google Sheets. Hãy đặt quyền 'Anyone with the link can view' hoặc dùng link public.",
    );
  }
  const text = await response.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.slice(0, 200).toLowerCase().includes("<html")) {
    throw new Error(
      "Sheet yêu cầu đăng nhập hoặc không public. Chia sẻ 'Anyone with the link' rồi thử lại.",
    );
  }
  return text;
}
