import type { CommissionConfig, CommissionRates, StoreLevel } from "./types";

export const STORE_LEVELS: StoreLevel[] = [1, 2, 3, 4, 5];

export const DEFAULT_TVV_LEVEL: StoreLevel = 3;

export const MIN_COMPLETION = 0.7;
export const OVER_PLAN_FACTOR = 1.2;
export const TRAINEE_FACTOR = 0.8;
export const CASHIER_DT_WEIGHT = 0.5;
export const CASHIER_SL_WEIGHT = 0.5;
export const CASHIER_MAX_PCT = 1.2;

const DEFAULT_RATES: CommissionRates = {
  cht: {
    1: { tichTru: 500, ts24k: 3_000, tsKhacPct: 0.18 },
    2: { tichTru: 550, ts24k: 3_300, tsKhacPct: 0.19 },
    3: { tichTru: 600, ts24k: 3_600, tsKhacPct: 0.2 },
    4: { tichTru: 650, ts24k: 3_900, tsKhacPct: 0.21 },
    5: { tichTru: 750, ts24k: 4_500, tsKhacPct: 0.22 },
  },
  tvv: {
    1: { tichTru: 3_000, ts24k: 15_000, tsKhacPct: 0.9 },
    2: { tichTru: 3_300, ts24k: 16_500, tsKhacPct: 0.95 },
    3: { tichTru: 3_600, ts24k: 18_000, tsKhacPct: 0.99 },
    4: { tichTru: 3_900, ts24k: 19_500, tsKhacPct: 1.04 },
    5: { tichTru: 4_200, ts24k: 21_000, tsKhacPct: 1.08 },
  },
  cashier: {
    1: 6_500_000,
    2: 5_000_000,
    3: 4_000_000,
    4: 3_000_000,
    5: 2_500_000,
  },
};

export function cloneDefaultRates(): CommissionRates {
  return structuredClone(DEFAULT_RATES);
}

export function createDefaultCommissionConfig(): CommissionConfig {
  return {
    storeLevel: 3,
    chtName: "",
    chtTrainee: false,
    cashierName: "",
    tvvLevels: {},
    rates: cloneDefaultRates(),
  };
}
