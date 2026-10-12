import type { CategoryId } from "@/lib/check-stock/types";

export type PosColumn = { key: string; label: string };

export type TemplateSection = {
  id: string;
  title: string;
  columns?: PosColumn[];
  /** Khối nhập trọng lượng (NGUYÊN LIỆU). */
  weight?: boolean;
};

export type StockTemplate = {
  category: CategoryId;
  slug: string;
  title: string;
  leadingBlanks: number;
  columns: PosColumn[];
  sections: TemplateSection[];
  /** Loại 1 luôn có cột trọng lượng. */
  weightColumns: boolean;
};

const STORE: PosColumn[] = [
  { key: "ket", label: "KÉT" },
  { key: "tu", label: "TỦ" },
  { key: "quay", label: "QUẦY" },
];

const COUNTER: PosColumn[] = [
  { key: "ket", label: "KÉT" },
  { key: "quay", label: "QUẦY" },
  { key: "hangMuaLai", label: "Hàng mua lại" },
];

const MATERIAL: PosColumn[] = [
  { key: "ket", label: "SL Két" },
  { key: "quay", label: "SL Quầy" },
  { key: "hangMuaLai", label: "Hàng mua lại" },
];

export const TEMPLATES: StockTemplate[] = [
  {
    category: "loai1",
    slug: "tich-tru",
    title: "KIỂM ĐẾM HÀNG HÓA — TÍCH TRỮ",
    leadingBlanks: 1,
    columns: STORE,
    weightColumns: true,
    sections: [
      { id: "0.1", title: "0.1" },
      { id: "1", title: "1" },
      { id: "NHẪN", title: "NHẪN" },
      { id: "HOA SEN", title: "HOA SEN" },
      { id: "BẠC TQ", title: "BẠC TQ" },
      { id: "BẠC TT", title: "BẠC TT" },
      { id: "NGUYÊN LIỆU", title: "NGUYÊN LIỆU", columns: MATERIAL, weight: true },
    ],
  },
  {
    category: "loai2",
    slug: "vang-tay",
    title: "KIỂM ĐẾM HÀNG HÓA — VÀNG TÂY",
    leadingBlanks: 1,
    columns: COUNTER,
    weightColumns: false,
    sections: [
      { id: "TS VÀNG TÂY", title: "TS VÀNG TÂY (gồm nhẫn cưới, kim cương)" },
      { id: "TRANG SỨC BẠC", title: "TRANG SỨC BẠC" },
    ],
  },
  {
    category: "loai3",
    slug: "vang-ta",
    title: "KIỂM ĐẾM HÀNG HÓA — VÀNG TA",
    leadingBlanks: 1,
    columns: COUNTER,
    weightColumns: false,
    sections: [
      { id: "VÀNG TA", title: "VÀNG TA" },
      { id: "CHỦNG LOẠI KHÁC", title: "CHỦNG LOẠI KHÁC (sản phẩm phong thủy)" },
      { id: "TRÂN BẢO", title: "TRÂN BẢO" },
      { id: "ECOM", title: "ECOM" },
    ],
  },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  loai1: "Loại 1 — Tích trữ",
  loai2: "Loại 2 — Vàng Tây",
  loai3: "Loại 3 — Vàng Ta",
};

export function templateOf(category: CategoryId): StockTemplate {
  return TEMPLATES.find((item) => item.category === category) ?? TEMPLATES[0];
}

export function sectionsFor(category: CategoryId, extraIds: string[]): TemplateSection[] {
  const template = templateOf(category);
  const known = new Set(template.sections.map((section) => section.id));
  const extras = extraIds
    .filter((id) => !known.has(id))
    .map((id) => ({ id, title: id }));
  return [...template.sections, ...extras];
}

export function positionColumns(category: CategoryId, sectionId: string): PosColumn[] {
  const template = templateOf(category);
  const section = template.sections.find((item) => item.id === sectionId);
  return section?.columns ?? template.columns;
}

export function sectionIsWeight(category: CategoryId, sectionId: string): boolean {
  const template = templateOf(category);
  return Boolean(template.sections.find((item) => item.id === sectionId)?.weight);
}
