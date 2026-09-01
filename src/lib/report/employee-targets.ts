import type {
  EmployeeTargetBreakdownRow,
  EmployeeTargetDetail,
  EmployeeTargetPlan,
  SalesRow,
} from "./types";
import { pct } from "./targets";

type SlUnit = "chi" | "piece";

function productCategoryToDtLabel(category: string): string {
  switch (category) {
    case "Vàng tích lũy":
      return "Vàng TT";
    case "Bạc tích lũy":
      return "Bạc TT";
    case "TS vàng ta":
      return "Trang sức vàng ta";
    default:
      return "Trang sức khác";
  }
}

/** Đơn vị SL mặc định theo danh mục bán hàng (chỉ → trọng lượng vàng). */
function defaultSlUnitForCategory(category: string): SlUnit {
  switch (category) {
    case "Vàng tích lũy":
    case "Bạc tích lũy":
    case "TS vàng ta":
    case "Nguyên liệu":
      return "chi";
    default:
      return "piece";
  }
}

/** Đọc đơn vị từ nhãn cột target, ví dụ "Vàng TT (Chỉ)" hoặc "Trang sức khác (Chiếc)". */
function slUnitFromBreakdownLabel(label: string): SlUnit {
  const norm = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (norm.includes("chiec")) return "piece";
  if (norm.includes("chi")) return "chi";
  return "chi";
}

function slUnitsByDtLabel(plan: EmployeeTargetPlan | null): Map<string, SlUnit> {
  const map = new Map<string, SlUnit>();
  if (!plan) return map;
  plan.dtBreakdown.forEach((dt, idx) => {
    const slLabel = plan.slBreakdown[idx]?.label ?? "";
    map.set(dt.label, slUnitFromBreakdownLabel(slLabel));
  });
  return map;
}

function slForRow(r: SalesRow, unit: SlUnit): number {
  return unit === "chi" ? r.goldWeight : r.quantity;
}

function normName(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function rowRevenue(r: SalesRow): number {
  return r.netRevenue || r.grossAmount || r.revenue;
}

/** Sản lượng tính lương: chỉ (trọng lượng vàng) hoặc chiếc (số lượng) theo danh mục. */
export function payrollSlForRow(r: SalesRow, slUnitsByLabel?: Map<string, SlUnit>): number {
  const dtLabel = productCategoryToDtLabel(r.productCategory || "Khác");
  const unit =
    slUnitsByLabel?.get(dtLabel) ??
    defaultSlUnitForCategory(r.productCategory || "Khác");
  return slForRow(r, unit);
}

function findPlanByName(
  plans: EmployeeTargetPlan[],
  employeeName: string,
): EmployeeTargetPlan | null {
  const norm = normName(employeeName);
  return (
    plans.find((p) => normName(p.name) === norm) ??
    plans.find((p) => normName(p.name).includes(norm) || norm.includes(normName(p.name))) ??
    null
  );
}

function buildSuggestions(
  dtPct: number | null,
  slPct: number | null,
  dtRemaining: number,
  slRemaining: number,
): string[] {
  const tips: string[] = [];

  if (dtPct == null && slPct == null) {
    return ["Chưa có chỉ tiêu kế hoạch cho nhân viên này trong file target."];
  }

  if (dtPct != null) {
    if (dtPct >= 1) {
      tips.push("Doanh thu kế hoạch: đã đạt chỉ tiêu tháng.");
    } else if (dtPct >= 0.8) {
      tips.push(
        `Doanh thu kế hoạch: gần đạt (${Math.round(dtPct * 1000) / 10}%) — còn ${formatShortVnd(dtRemaining)}.`,
      );
    } else {
      tips.push(
        `Doanh thu kế hoạch: cần đẩy mạnh (${Math.round(dtPct * 1000) / 10}%) — còn ${formatShortVnd(dtRemaining)}.`,
      );
    }
  }

  if (slPct != null) {
    if (slPct >= 1) {
      tips.push("Sản lượng tính lương: đã đạt chỉ tiêu tháng.");
    } else if (slPct >= 0.8) {
      tips.push(
        `Sản lượng tính lương: gần đạt (${Math.round(slPct * 1000) / 10}%) — còn ${formatShortNum(slRemaining)} đơn vị.`,
      );
    } else {
      tips.push(
        `Sản lượng tính lương: cần cải thiện (${Math.round(slPct * 1000) / 10}%) — còn ${formatShortNum(slRemaining)} đơn vị.`,
      );
    }
  }

  if (dtPct != null && slPct != null) {
    if (dtPct < 0.7 && slPct < 0.7) {
      tips.push("Ưu tiên: tăng cả doanh thu và sản lượng tính lương.");
    } else if (dtPct >= 0.9 && slPct < 0.8) {
      tips.push("Doanh thu tốt — tập trung nâng sản lượng / số đơn.");
    } else if (slPct >= 0.9 && dtPct < 0.8) {
      tips.push("Sản lượng tốt — tập trung upsell để nâng doanh thu.");
    } else if (dtPct >= 1 && slPct >= 1) {
      tips.push("Xuất sắc — duy trì momentum và hỗ trợ đồng nghiệp.");
    }
  }

  return tips;
}

function formatShortVnd(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function formatShortNum(value: number): string {
  return Math.round(value * 10) / 10 === Math.round(value)
    ? String(Math.round(value))
    : (Math.round(value * 10) / 10).toLocaleString("vi-VN");
}

export function buildEmployeeTargetDetails(
  sales: SalesRow[],
  plans: EmployeeTargetPlan[],
  asOfDate: string,
  planMonth: string,
  employeeNames: string[],
): EmployeeTargetDetail[] {
  const planSales = sales.filter(
    (r) => r.date.startsWith(planMonth) && r.date <= asOfDate,
  );

  const actualByName = new Map<string, { dt: number; sl: number }>();
  for (const r of planSales) {
    const name = r.employeeName || "Không xác định";
    const prev = actualByName.get(name) ?? { dt: 0, sl: 0 };
    prev.dt += rowRevenue(r);
    actualByName.set(name, prev);
  }

  return employeeNames.map((name) => {
    const plan = findPlanByName(plans, name);
    const slUnits = slUnitsByDtLabel(plan);

    const actual = actualByName.get(name) ?? { dt: 0, sl: 0 };
    actual.sl = 0;
    for (const r of planSales.filter((row) => (row.employeeName || "Không xác định") === name)) {
      actual.sl += payrollSlForRow(r, slUnits);
    }

    const dtPlan = plan?.dtPlan ?? 0;
    const slPlan = plan?.slPayroll ?? 0;
    const dtRemaining = Math.max(0, dtPlan - actual.dt);
    const slRemaining = Math.max(0, slPlan - actual.sl);

    const dtByLabel = new Map<string, number>();
    const slByLabel = new Map<string, number>();
    for (const r of planSales.filter((row) => (row.employeeName || "Không xác định") === name)) {
      const label = productCategoryToDtLabel(r.productCategory || "Khác");
      const unit =
        slUnits.get(label) ?? defaultSlUnitForCategory(r.productCategory || "Khác");
      dtByLabel.set(label, (dtByLabel.get(label) ?? 0) + rowRevenue(r));
      slByLabel.set(label, (slByLabel.get(label) ?? 0) + slForRow(r, unit));
    }

    const breakdown =
      plan?.dtBreakdown.map((dt, idx) => ({
        label: dt.label,
        dtActual: dtByLabel.get(dt.label) ?? 0,
        dtPlan: dt.value,
        slActual: slByLabel.get(dt.label) ?? 0,
        slPlan: plan.slBreakdown[idx]?.value ?? 0,
      })) ?? [];

    return {
      name,
      code: plan?.code ?? null,
      asOfDate,
      dtActual: actual.dt,
      dtPlan,
      dtPct: pct(actual.dt, dtPlan),
      dtRemaining,
      slActual: actual.sl,
      slPlan,
      slPct: pct(actual.sl, slPlan),
      slRemaining,
      breakdown,
      suggestions: buildSuggestions(
        pct(actual.dt, dtPlan),
        pct(actual.sl, slPlan),
        dtRemaining,
        slRemaining,
      ),
    };
  });
}

export function getEmployeeTargetDetail(
  details: EmployeeTargetDetail[],
  name: string,
): EmployeeTargetDetail | null {
  return details.find((d) => d.name === name) ?? null;
}

const STORE_BREAKDOWN_ORDER = [
  "Vàng TT",
  "Bạc TT",
  "Trang sức vàng ta",
  "Trang sức khác",
];

/** Cộng chỉ tiêu / thực tế theo ngành hàng của toàn cửa hàng (từ breakdown từng TVV). */
export function buildStoreTargetBreakdown(
  details: EmployeeTargetDetail[],
): EmployeeTargetBreakdownRow[] {
  const map = new Map<string, EmployeeTargetBreakdownRow>();

  for (const detail of details) {
    for (const row of detail.breakdown) {
      const prev = map.get(row.label) ?? {
        label: row.label,
        dtActual: 0,
        dtPlan: 0,
        slActual: 0,
        slPlan: 0,
      };
      prev.dtActual += row.dtActual;
      prev.dtPlan += row.dtPlan;
      prev.slActual += row.slActual;
      prev.slPlan += row.slPlan;
      map.set(row.label, prev);
    }
  }

  const ordered = STORE_BREAKDOWN_ORDER.map((label) => map.get(label)).filter(
    (row): row is EmployeeTargetBreakdownRow => row != null,
  );
  const rest = [...map.values()].filter((row) => !STORE_BREAKDOWN_ORDER.includes(row.label));
  return [...ordered, ...rest];
}
