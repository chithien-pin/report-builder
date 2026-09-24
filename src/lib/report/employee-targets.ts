import type {
  EmployeeTargetBreakdownRow,
  EmployeeTargetDetail,
  EmployeeTargetPlan,
  SalesRow,
  TargetData,
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
    case "BST":
      return "TS Ý+BST";
    case "TS vàng tây":
      return "TS vàng Tây Khác";
    case "Hỗn hợp":
      return "Hỗn Hợp";
    default:
      return "Trang sức khác";
  }
}

const SPLIT_OTHER_LABELS = new Set([
  "TS Ý+BST",
  "TS vàng Tây Khác",
  "Hỗn Hợp",
  "Trang sức khác",
]);

/** Map sales category → label cột DT trong file target (hỗ trợ schema cũ/mới). */
function mapCategoryToPlanLabel(category: string, planLabels: Set<string>): string {
  const preferred = productCategoryToDtLabel(category);
  if (planLabels.size === 0 || planLabels.has(preferred)) return preferred;

  if (SPLIT_OTHER_LABELS.has(preferred)) {
    if (planLabels.has("Trang sức khác")) return "Trang sức khác";
    if (preferred === "Trang sức khác" && planLabels.has("Hỗn Hợp")) return "Hỗn Hợp";
  }
  return preferred;
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
  const planLabels = slUnitsByLabel ? new Set(slUnitsByLabel.keys()) : new Set<string>();
  const dtLabel = mapCategoryToPlanLabel(r.productCategory || "Khác", planLabels);
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
    const planLabels = new Set((plan?.dtBreakdown ?? []).map((d) => d.label));
    for (const r of planSales.filter((row) => (row.employeeName || "Không xác định") === name)) {
      const label = mapCategoryToPlanLabel(r.productCategory || "Khác", planLabels);
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
  "TS Ý+BST",
  "TS vàng Tây Khác",
  "Hỗn Hợp",
  "Trang sức khác",
];

function baseColumnLabel(label: string): string {
  return (label.split("·")[0] ?? label).replace(/\s+/g, " ").trim();
}

/** KH DT theo ngành từ hàng TỔNG (monthTotals) — khớp tổng cửa hàng. */
function dtPlansFromMonthTotals(target: TargetData): Map<string, number> {
  const map = new Map<string, number>();
  for (const col of target.columns) {
    if (col.kind !== "dt") continue;
    const label = baseColumnLabel(col.label);
    if (!label || /^tổng$/i.test(label)) continue;
    map.set(label, (map.get(label) ?? 0) + (target.monthTotals[col.key] ?? 0));
  }
  return map;
}

/** KH SL tính lương theo ngành — cộng mọi TVV trong file target. */
function slPlansFromEmployeePlans(plans: EmployeeTargetPlan[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const plan of plans) {
    plan.dtBreakdown.forEach((dt, idx) => {
      const label = dt.label;
      map.set(label, (map.get(label) ?? 0) + (plan.slBreakdown[idx]?.value ?? 0));
    });
  }
  return map;
}

/**
 * Tiến độ ngành hàng toàn cửa hàng.
 * - Kế hoạch DT: lấy từ hàng TỔNG (đảm bảo 6 cột cộng = Tổng)
 * - Kế hoạch SL: cộng mọi TVV trong target
 * - Thực tế: cộng từ breakdown từng TVV có doanh số
 */
export function buildStoreTargetBreakdown(
  details: EmployeeTargetDetail[],
  target?: TargetData | null,
): EmployeeTargetBreakdownRow[] {
  const map = new Map<string, EmployeeTargetBreakdownRow>();

  const dtPlans = target ? dtPlansFromMonthTotals(target) : new Map<string, number>();
  const slPlans = target
    ? slPlansFromEmployeePlans(target.employeePlans ?? [])
    : new Map<string, number>();

  for (const [label, dtPlan] of dtPlans) {
    map.set(label, {
      label,
      dtActual: 0,
      dtPlan,
      slActual: 0,
      slPlan: slPlans.get(label) ?? 0,
    });
  }

  // Nếu chưa có monthTotals (edge), seed từ plans TVV
  if (map.size === 0 && target?.employeePlans?.length) {
    for (const plan of target.employeePlans) {
      plan.dtBreakdown.forEach((dt, idx) => {
        const prev = map.get(dt.label) ?? {
          label: dt.label,
          dtActual: 0,
          dtPlan: 0,
          slActual: 0,
          slPlan: 0,
        };
        prev.dtPlan += dt.value;
        prev.slPlan += plan.slBreakdown[idx]?.value ?? 0;
        map.set(dt.label, prev);
      });
    }
  }

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
      prev.slActual += row.slActual;
      // Fallback khi không có target: cộng KH từ từng TVV (hành vi cũ)
      if (!target) {
        prev.dtPlan += row.dtPlan;
        prev.slPlan += row.slPlan;
      } else if (!map.has(row.label)) {
        // Nhãn chỉ có ở TVV (không có trong TỔNG) — giữ KH từ TVV
        prev.dtPlan += row.dtPlan;
        prev.slPlan += row.slPlan;
      }
      map.set(row.label, prev);
    }
  }

  const ordered = STORE_BREAKDOWN_ORDER.map((label) => map.get(label)).filter(
    (row): row is EmployeeTargetBreakdownRow => row != null,
  );
  const rest = [...map.values()].filter((row) => !STORE_BREAKDOWN_ORDER.includes(row.label));
  return [...ordered, ...rest];
}
