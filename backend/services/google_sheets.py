from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import httpx

EXPORT_BASE = "https://docs.google.com/spreadsheets/d/{sheet_id}/export"


def _extract_sheet_id(url: str) -> str | None:
    patterns = [
        r"/spreadsheets/d/([a-zA-Z0-9-_]+)",
        r"docs\.google\.com/spreadsheets/d/e/([a-zA-Z0-9-_]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _extract_gid(url: str) -> str | None:
    parsed = urlparse(url)
    query_gid = parse_qs(parsed.query).get("gid", [None])[0]
    if query_gid:
        return str(query_gid)
    fragment = parsed.fragment or ""
    if "gid=" in fragment:
        return fragment.split("gid=")[-1].split("&")[0]
    return None


def to_csv_export_url(url: str) -> str:
    sheet_id = _extract_sheet_id(url)
    if not sheet_id:
        raise ValueError("Không nhận diện được link Google Sheets hợp lệ.")

    gid = _extract_gid(url)
    export_url = EXPORT_BASE.format(sheet_id=sheet_id) + "?format=csv"
    if gid:
        export_url += f"&gid={gid}"
    return export_url


async def fetch_public_sheet_csv(url: str) -> str:
    export_url = to_csv_export_url(url)
    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        response = await client.get(export_url)
        if response.status_code != 200:
            raise ValueError(
                "Không tải được Google Sheets. Hãy đặt quyền 'Anyone with the link can view' "
                "hoặc dùng link public."
            )
        text = response.text
        if text.strip().startswith("<!DOCTYPE") or "<html" in text[:200].lower():
            raise ValueError(
                "Sheet yêu cầu đăng nhập hoặc không public. "
                "Chia sẻ 'Anyone with the link' rồi thử lại."
            )
        return text
