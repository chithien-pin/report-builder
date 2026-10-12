export type CategoryId = "loai1" | "loai2" | "loai3";
export type LineMode = "qty" | "weight";

export type CountLine = {
  id: string;
  category: CategoryId;
  section: string;
  label: string;
  prefixes: string[];
  unitWeight?: number;
  weightTolerance?: number;
  mode: LineMode;
  verified: boolean;
  /** Ô nhập số, không gắn đầu mã. */
  countOnly?: boolean;
  order: number;
};

export type LinesFile = {
  rev: number;
  updatedAt: string;
  qtyTolerance: number;
  lines: CountLine[];
};

export type SystemRow = {
  maHang: string;
  maVach?: string;
  ten: string;
  donVi: string;
  maNhom: string;
  nhomLon?: string;
  tenNhomLon?: string;
  chungLoai?: string;
  tenChungLoai?: string;
  sl: number;
  trongLuong?: number;
};

export type DatasetMeta = {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  rowCount: number;
  totalQty: number;
  reportDate?: string | null;
};

export type DatasetsIndex = {
  rev: number;
  updatedAt: string;
  activeId: string | null;
  items: DatasetMeta[];
};

export type DatasetFile = {
  id: string;
  reportDate: string | null;
  rows: SystemRow[];
};

export type SessionDoc = {
  rev: number;
  id: string;
  category: CategoryId;
  datasetId: string;
  date: string;
  time: string;
  ca: string;
  inspector: string;
  controller: string;
  cells: Record<string, Record<string, number>>;
  weightOverride: Record<string, number>;
  notes: Record<string, string>;
  lastExportedAt?: string;
  updatedAt: string;
};

export type SessionListItem = {
  category: CategoryId;
  key: string;
  date: string;
  time: string;
  ca: string;
  inspector: string;
  datasetId: string;
  updatedAt: string;
  lastExportedAt?: string;
};

export type ColumnMap = {
  maHang: string;
  maVach: string;
  ten: string;
  donVi: string;
  maNhom: string;
  nhomLon: string;
  tenNhomLon: string;
  chungLoai: string;
  tenChungLoai: string;
  sl: string;
  trongLuong: string;
};

export const DEFAULT_COLUMNS: ColumnMap = {
  maHang: "Mã hàng",
  maVach: "Mã vạch",
  ten: "Tên hàng",
  donVi: "Đ.Vị",
  maNhom: "Mã nhóm",
  nhomLon: "Nhóm lớn",
  tenNhomLon: "Tên nhóm lớn",
  chungLoai: "Chủng loại",
  tenChungLoai: "Tên chủng loại",
  sl: "SL C.Kỳ",
  trongLuong: "TT.Lượng",
};

export class RevConflict<T> extends Error {
  readonly current: T;

  constructor(current: T) {
    super("rev-conflict");
    this.name = "RevConflict";
    this.current = current;
  }
}
