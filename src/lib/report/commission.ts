import {
  CASHIER_DT_WEIGHT,
  CASHIER_MAX_PCT,
  CASHIER_SL_WEIGHT,
  DEFAULT_TVV_LEVEL,
  MIN_COMPLETION,
  OVER_PLAN_FACTOR,
  TRAINEE_FACTOR,
} from "./commission-defaults";
import { pct } from "./targets";
import type {
  CommissionConfig,
  CommissionForecast,
  CommissionGroupKey,
  CommissionGroupLine,
  CommissionLevelRates,
  CommissionPersonRow,
  EmployeeTargetBreakdownRow,
  EmployeeTargetDetail,
  MonthKpiSummary,
  StoreLevel,
} from "./types";

const GROUP_LABELS: Record<CommissionGroupKey, string> = {
  "tich-tru": "Tích trữ",
  ts24k: "TS 24k",
  "ts-khac": "TS Khác",
};

type GroupBucket = {
  slActual: number;
  slPlan: number;
  dtActual: number;
  dtPlan: number;
};

function emptyBuckets(): Record<CommissionGroupKey, GroupBucket> {
  return {
    "tich-tru": { slActual: 0, slPlan: 0, dtActual: 0, dtPlan: 0 },
    ts24k: { slActual: 0, slPlan: 0, dtActual: 0, dtPlan: 0 },
    "ts-khac": { slActual: 0, slPlan: 0, dtActual: 0, dtPlan: 0 },
  };
}

function normLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function commissionGroupForLabel(label: string): CommissionGroupKey | null {
  const n = normLabel(label);
  if (n.includes("vang tt") || n.includes("bac tt")) return "tich-tru";
  if (n.includes("trang suc vang ta") || n.includes("ts vang ta") || n.includes("ts24k")) {
    return "ts24k";
  }
  if (n.includes("trang suc khac") || n.includes("ts khac")) return "ts-khac";
  return null;
}

function addBreakdown(
  buckets: Record<CommissionGroupKey, GroupBucket>,
  rows: EmployeeTargetBreakdownRow[],
) {
  for (const row of rows) {
    const key = commissionGroupForLabel(row.label);
    if (!key) continue;
    const bucket = buckets[key];
    bucket.slActual += row.slActual;
    bucket.slPlan += row.slPlan;
    bucket.dtActual += row.dtActual;
    bucket.dtPlan += row.dtPlan;
  }
}

function scaleRates(rates: CommissionLevelRates, factor: number): CommissionLevelRates {
  return {
    tichTru: rates.tichTru * factor,
    ts24k: rates.ts24k * factor,
    tsKhacPct: rates.tsKhacPct * factor,
  };
}

/** HH = phần trong KH × đơn giá + phần vượt KH × đơn giá × 1.2 (nếu ≥ 70%). */
function commissionAmount(actual: number, plan: number, unitPrice: number): {
  amount: number;
  eligible: boolean;
  overPlan: boolean;
  pct: number | null;
} {
  const completion = pct(actual, plan);
  if (completion == null) {
    return { amount: 0, eligible: false, overPlan: false, pct: null };
  }
  const eligible = completion >= MIN_COMPLETION;
  const overPlan = completion > 1;
  if (!eligible) {
    return { amount: 0, eligible, overPlan, pct: completion };
  }
  const within = Math.min(actual, plan) * unitPrice;
  const excess = Math.max(0, actual - plan) * unitPrice * OVER_PLAN_FACTOR;
  return { amount: within + excess, eligible, overPlan, pct: completion };
}

function linesFromBuckets(
  buckets: Record<CommissionGroupKey, GroupBucket>,
  rates: CommissionLevelRates,
): CommissionGroupLine[] {
  const keys: CommissionGroupKey[] = ["tich-tru", "ts24k", "ts-khac"];
  return keys.map((key) => {
    const bucket = buckets[key];
    const useDt = key === "ts-khac";
    const actual = useDt ? bucket.dtActual : bucket.slActual;
    const plan = useDt ? bucket.dtPlan : bucket.slPlan;
    const unitPrice =
      key === "tich-tru"
        ? rates.tichTru
        : key === "ts24k"
          ? rates.ts24k
          : rates.tsKhacPct / 100;
    const calc = commissionAmount(actual, plan, unitPrice);
    return {
      key,
      label: GROUP_LABELS[key],
      actual,
      plan,
      pct: calc.pct,
      eligible: calc.eligible,
      overPlan: calc.overPlan,
      amount: calc.amount,
      unit: useDt ? "vnd" : "chi",
    };
  });
}

function personNote(lines: CommissionGroupLine[], extra?: string): string {
  const parts: string[] = [];
  if (extra) parts.push(extra);
  const ineligible = lines.filter((l) => l.pct != null && !l.eligible);
  if (ineligible.length > 0) {
    parts.push(
      `Chưa đủ 70%: ${ineligible.map((l) => l.label).join(", ")}`,
    );
  }
  const over = lines.filter((l) => l.overPlan);
  if (over.length > 0) {
    parts.push(`Vượt KH (hệ số 1.2): ${over.map((l) => l.label).join(", ")}`);
  }
  if (parts.length === 0) return "Đủ điều kiện hưởng theo từng nhóm hàng.";
  return parts.join(" · ");
}

export function buildTvvCommission(
  detail: EmployeeTargetDetail,
  config: CommissionConfig,
): CommissionPersonRow {
  const level: StoreLevel = config.tvvLevels[detail.name] ?? DEFAULT_TVV_LEVEL;
  const buckets = emptyBuckets();
  addBreakdown(buckets, detail.breakdown);
  const groups = linesFromBuckets(buckets, config.rates.tvv[level]);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  return {
    role: "tvv",
    name: detail.name,
    level,
    groups,
    total,
    eligible: groups.some((g) => g.eligible),
    note: personNote(groups, `Cấp ${level}`),
  };
}

function chtRow(
  details: EmployeeTargetDetail[],
  config: CommissionConfig,
): CommissionPersonRow | null {
  const name = config.chtName.trim();
  if (!name) return null;
  const buckets = emptyBuckets();
  for (const d of details) addBreakdown(buckets, d.breakdown);
  const factor = config.chtTrainee ? TRAINEE_FACTOR : 1;
  const rates = scaleRates(config.rates.cht[config.storeLevel], factor);
  const groups = linesFromBuckets(buckets, rates);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const extras = [
    `Cấp CH ${config.storeLevel}`,
    config.chtTrainee ? "Tập sự 80%" : null,
  ].filter((x): x is string => Boolean(x));
  return {
    role: "cht",
    name,
    level: config.storeLevel,
    groups,
    total,
    eligible: groups.some((g) => g.eligible),
    note: personNote(groups, extras.join(" · ")),
  };
}

function cashierRow(
  monthKpi: MonthKpiSummary | null,
  config: CommissionConfig,
): CommissionPersonRow | null {
  const name = config.cashierName.trim();
  if (!name) return null;
  const base = config.rates.cashier[config.storeLevel];
  const dtPct = monthKpi?.dtPct ?? null;
  const slPct = monthKpi?.slPct ?? null;
  const hasDt = dtPct != null;
  const hasSl = slPct != null;
  const completion =
    hasDt && hasSl
      ? CASHIER_DT_WEIGHT * dtPct + CASHIER_SL_WEIGHT * slPct
      : hasDt
        ? dtPct
        : hasSl
          ? slPct
          : null;
  const eligible = completion != null && completion >= MIN_COMPLETION;
  const capped = completion != null ? Math.min(completion, CASHIER_MAX_PCT) : 0;
  const amount = eligible ? base * capped : 0;
  const noteParts = [`Cấp CH ${config.storeLevel}`];
  if (completion == null) {
    noteParts.push("Chưa có % DT / SL cửa hàng.");
  } else if (!eligible) {
    noteParts.push(`CH hoàn thành ${Math.round(completion * 1000) / 10}% (< 70%) — không hưởng.`);
  } else if (completion > CASHIER_MAX_PCT) {
    noteParts.push("Trần hưởng 120%.");
  } else {
    noteParts.push(
      `Hưởng ${Math.round(capped * 1000) / 10}% mức tháng (50% DT + 50% SL).`,
    );
  }
  return {
    role: "cashier",
    name,
    level: config.storeLevel,
    groups: [],
    total: amount,
    eligible,
    note: noteParts.join(" · "),
  };
}

export function buildCommissionForecast(
  details: EmployeeTargetDetail[],
  monthKpi: MonthKpiSummary | null,
  config: CommissionConfig,
): CommissionForecast {
  const tvv = details
    .filter((d) => d.name && d.name !== "Không xác định")
    .map((d) => buildTvvCommission(d, config))
    .sort((a, b) => b.total - a.total);
  const cht = chtRow(details, config);
  const cashier = cashierRow(monthKpi, config);
  const grandTotal =
    tvv.reduce((s, r) => s + r.total, 0) +
    (cht?.total ?? 0) +
    (cashier?.total ?? 0);
  return {
    asOfDate: monthKpi?.asOfDate ?? details[0]?.asOfDate ?? "",
    tvv,
    cht,
    cashier,
    grandTotal,
  };
}
