from __future__ import annotations

import json
from pathlib import Path

from services.models import DatasetMeta

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def parquet_path(dataset_id: str) -> Path:
    return CACHE_DIR / f"{dataset_id}.parquet"


def meta_path(dataset_id: str) -> Path:
    return CACHE_DIR / f"{dataset_id}.meta.json"


def save_meta(meta: DatasetMeta) -> None:
    meta_path(meta.dataset_id).write_text(
        meta.model_dump_json(indent=2),
        encoding="utf-8",
    )


def load_meta(dataset_id: str) -> DatasetMeta:
    path = meta_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' not found")
    return DatasetMeta.model_validate_json(path.read_text(encoding="utf-8"))


def dataset_exists(dataset_id: str) -> bool:
    return parquet_path(dataset_id).exists() and meta_path(dataset_id).exists()
