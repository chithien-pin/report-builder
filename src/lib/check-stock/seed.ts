import { lineId } from "@/lib/check-stock/format";
import type { CategoryId, CountLine, LineMode } from "@/lib/check-stock/types";

type Seed = {
  t: CategoryId;
  section: string;
  label: string;
  prefixes: string[];
  unitWeight?: number;
  weightTolerance?: number;
  mode?: LineMode;
  verified: boolean;
  countOnly?: boolean;
};

function lines(rows: Seed[]): CountLine[] {
  const order = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.t}:${row.section}`;
    const next = (order.get(key) ?? 0) + 1;
    order.set(key, next);
    const line: CountLine = {
      id: lineId(row.t, row.section, row.label),
      category: row.t,
      section: row.section,
      label: row.label,
      prefixes: row.prefixes,
      mode: row.mode ?? "qty",
      verified: row.verified,
      order: next,
    };
    if (row.unitWeight != null) line.unitWeight = row.unitWeight;
    if (row.weightTolerance != null) line.weightTolerance = row.weightTolerance;
    if (row.countOnly) line.countOnly = true;
    return line;
  });
}

const L1 = "loai1" as const;
const L2 = "loai2" as const;
const L3 = "loai3" as const;

function gram(section: string, label: string, prefix: string, unitWeight: number, tolerance?: number): Seed {
  return {
    t: L1,
    section,
    label,
    prefixes: [prefix],
    unitWeight,
    weightTolerance: tolerance,
    verified: true,
  };
}

export function seedLines(): CountLine[] {
  return lines([
    gram("0.1", "TÙNG O", "KTT01", 0.1),
    gram("0.1", "CÚC O", "KCT01", 0.1),
    gram("0.1", "TRÚC O", "KBT01", 0.1),
    gram("0.1", "MAI O", "KMT01", 0.1),
    gram("0.1", "TÙNG CN", "KTC01", 0.1),
    gram("0.1", "CÚC CN", "KCC01", 0.1),
    gram("0.1", "TRÚC CN", "KbC01", 0.1),
    gram("0.1", "MAI CN", "KmC01", 0.1),
    gram("0.1", "NHẪN 0.1", "TTKGV49KD0", 0.1),
    gram("0.1", "NHÀ THỜ ĐỨC BÀ", "TTMVV49KD0-607002", 0.1),
    gram("0.1", "CẦU RỒNG", "TTMVV49KD0-607001", 0.1),
    gram("0.1", "CHÙA MỘT CỘT", "TTMVV49KD0-607004", 0.1),
    gram("0.1", "HẠ LONG", "TTMVV49KD0-607003", 0.1),
    gram("0.1", "HỘI AN", "TTMVV49KD0-607006-002", 0.1),
    gram("0.1", "ĐỒNG THÁP", "TTMVV49KD0-607005-002", 0.1),
    gram("0.1", "NGHỆ AN", "TTMVV49KD0-607007-002", 0.1),
    gram("0.1", "KHÁNH HOÀ", "TTMVV49KD0-607008-002", 0.1),
    gram("0.1", "VSĐV SÀI GÒN", "QTMVV49KD0-604002-001", 0.1),
    gram("0.1", "VSĐV HÀ NỘI", "QTMVV49KD0-604003-001", 0.1),
    gram("0.1", "VSĐV ĐÀ NẴNG", "QTMVV49KD0-604004-001", 0.1),
    gram("0.1", "VSĐV QUẢNG NINH", "QTMVV49KD0-604001-001", 0.1),

    gram("1", "TÙNG O", "KTT1", 1),
    gram("1", "CÚC O", "KCT1", 1),
    gram("1", "TRÚC O", "KBT1", 1),
    gram("1", "MAI O", "KMT1", 1),
    gram("1", "TÙNG CN", "KTC1", 1),
    gram("1", "CÚC CN", "KCC1", 1),
    gram("1", "TRÚC CN", "KbC1", 1),
    gram("1", "MAI CN", "KmC1", 1),

    gram("NHẪN", "0.5", "KGB05", 0.5),
    gram("NHẪN", "1", "KGB1c", 1),
    gram("NHẪN", "2", "KGB2", 2),
    gram("NHẪN", "3", "KGB3", 3),
    gram("NHẪN", "5", "KGB5", 5),
    gram("NHẪN", "10", "KGB10", 10),

    gram("HOA SEN", "0.5", "KHS05", 0.5),
    gram("HOA SEN", "1", "KHS1c", 1),
    gram("HOA SEN", "2", "KHS2", 2),
    gram("HOA SEN", "3", "KHS3", 3),
    gram("HOA SEN", "5", "KHS5", 5),
    gram("HOA SEN", "10", "KHS10", 10),

    gram("BẠC TQ", "TÙNG 1L", "GBT01L", 10),
    gram("BẠC TQ", "CÚC 1L", "GBC01L", 10),
    gram("BẠC TQ", "TRÚC 1L", "GBB01L", 10),
    gram("BẠC TQ", "MAI 1L", "GBM01L", 10),
    gram("BẠC TQ", "TÙNG 3L", "GBT03L", 30),
    gram("BẠC TQ", "CÚC 3L", "GBC03L", 30),
    gram("BẠC TQ", "TRÚC 3L", "GBB03L", 30),
    gram("BẠC TQ", "MAI 3L", "GBM03L", 30),

    gram("BẠC TT", "5L", "NGB05l", 50),
    gram("BẠC TT", "10L", "NGB10l", 100),
    gram("BẠC TT", "1KG", "NGB01k", 267, 0.5),

    ...[
      "NL14K",
      "NL18K",
      "NLBAC",
      "NLNLV12KD0-508001-001",
      "NL06",
      "NL999",
      "NL9999",
      "NLKGB",
      "NL07",
      "NL999KD",
      "NL9999KD",
      "NL07KD",
    ].map(
      (code): Seed => ({
        t: L1,
        section: "NGUYÊN LIỆU",
        label: code,
        prefixes: [code],
        mode: "weight",
        verified: true,
      }),
    ),

    { t: L2, section: "TS VÀNG TÂY", label: "NHẪN", prefixes: ["VTN", "PYN", "PHN", "NHN", "NCCK", "NCCN", "NCCY", "NCN", "BTN", "TKN"], verified: true },
    { t: L2, section: "TS VÀNG TÂY", label: "KHUYÊN", prefixes: ["VTBT", "PYBT", "PHBT", "NHBT", "BTBT", "TKBT"], verified: true },
    { t: L2, section: "TS VÀNG TÂY", label: "DÂY", prefixes: [], verified: false },
    { t: L2, section: "TS VÀNG TÂY", label: "MẶT", prefixes: ["VTM", "PYM", "PHM", "NHM", "BTMA", "TKM"], verified: true },
    { t: L2, section: "TS VÀNG TÂY", label: "LẮC", prefixes: [], verified: false },
    { t: L2, section: "TS VÀNG TÂY", label: "CHARM", prefixes: [], verified: false },
    { t: L2, section: "TS VÀNG TÂY", label: "VỈ KIM CƯƠNG", prefixes: [], verified: false },

    { t: L2, section: "TRANG SỨC BẠC", label: "NHẪN", prefixes: ["BAN", "BCN", "BXN"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "KHUYÊN", prefixes: ["BABT", "BCBT", "BYBT", "BXBT"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "DÂY", prefixes: ["BAD", "BCD", "BYD", "BXD"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "MẶT", prefixes: ["BAM", "BCM"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "LẮC", prefixes: ["BAL", "BAV", "BCLT", "BYLT", "BXL"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "CHARM", prefixes: ["BACH"], verified: false },
    { t: L2, section: "TRANG SỨC BẠC", label: "XU", prefixes: [], verified: false },

    { t: L3, section: "VÀNG TA", label: "NHẪN", prefixes: ["24N", "VDN"], verified: false },
    { t: L3, section: "VÀNG TA", label: "KHUYÊN", prefixes: ["24BT", "VDBT"], verified: false },
    { t: L3, section: "VÀNG TA", label: "DÂY + KIỀNG", prefixes: ["24D", "VDD", "24K", "VDK"], verified: false },
    { t: L3, section: "VÀNG TA", label: "MẶT", prefixes: ["24M", "VDM"], verified: false },
    { t: L3, section: "VÀNG TA", label: "LẮC + VÒNG", prefixes: ["24L", "VDL", "24V", "VDV"], verified: false },
    { t: L3, section: "VÀNG TA", label: "CHARM", prefixes: [], verified: false },
    { t: L3, section: "VÀNG TA", label: "TƯỢNG", prefixes: [], verified: false },
    { t: L3, section: "VÀNG TA", label: "Xu quà tặng + Miếng vàng bìa đỏ", prefixes: [], verified: false },
    { t: L3, section: "VÀNG TA", label: "HOA HỒNG ÉP", prefixes: [], verified: false },

    { t: L3, section: "CHỦNG LOẠI KHÁC", label: "Sản phẩm phong thủy", prefixes: [], verified: false },
    { t: L3, section: "CHỦNG LOẠI KHÁC", label: "Hàng khắc tên", prefixes: [], verified: false, countOnly: true },

    { t: L3, section: "TRÂN BẢO", label: "PLBA", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "Cá chép", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "Khuê văn các", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "NCTY", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "ƯNTM", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "Phúc bảo đầu đời", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "Một đời chung đôi", prefixes: [], verified: false },
    { t: L3, section: "TRÂN BẢO", label: "Đào/Loa kèn/Hoa quỳnh/Hải đường 0.1C", prefixes: [], verified: false },

    { t: L3, section: "ECOM", label: "ECOM", prefixes: [], verified: false },
  ]);
}
