"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cloneDefaultRates,
  createDefaultCommissionConfig,
  STORE_LEVELS,
} from "@/lib/report/commission-defaults";
import type {
  CommissionConfig,
  CommissionLevelRates,
  CommissionRates,
  StoreLevel,
} from "@/lib/report/types";

function asLevel(value: string | number): StoreLevel {
  const n = Number(value);
  return (STORE_LEVELS.includes(n as StoreLevel) ? n : 3) as StoreLevel;
}

function parseNum(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function RateTable({
  title,
  unitHint,
  rows,
  onChange,
}: {
  title: string;
  unitHint: string;
  rows: CommissionRates["cht"] | CommissionRates["tvv"];
  onChange: (level: StoreLevel, patch: Partial<CommissionLevelRates>) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <p className="mb-2 text-xs text-muted-foreground">{unitHint}</p>
      <div className="overflow-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr className="bg-lavender-soft/50 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Cấp</th>
              <th className="px-3 py-2 text-right font-medium">HH tích trữ (đ/chỉ)</th>
              <th className="px-3 py-2 text-right font-medium">HH TS24k (đ/chỉ)</th>
              <th className="px-3 py-2 text-right font-medium">HH TS Khác (%)</th>
            </tr>
          </thead>
          <tbody>
            {STORE_LEVELS.map((level) => (
              <tr key={level} className="border-t border-border/40">
                <td className="px-3 py-1.5 font-medium">Cấp {level}</td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    className="h-8 rounded-lg text-right"
                    value={rows[level].tichTru}
                    onChange={(e) => onChange(level, { tichTru: parseNum(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    className="h-8 rounded-lg text-right"
                    value={rows[level].ts24k}
                    onChange={(e) => onChange(level, { ts24k: parseNum(e.target.value) })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 rounded-lg text-right"
                    value={rows[level].tsKhacPct}
                    onChange={(e) => onChange(level, { tsKhacPct: parseNum(e.target.value) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CommissionConfigDialog({
  open,
  onOpenChange,
  employeeNames,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeNames: string[];
  value: CommissionConfig;
  onSave: (config: CommissionConfig) => void;
}) {
  const [draft, setDraft] = useState<CommissionConfig>(value);

  useEffect(() => {
    if (open) setDraft(structuredClone(value));
  }, [open, value]);

  function patchRates(
    kind: "cht" | "tvv",
    level: StoreLevel,
    patch: Partial<CommissionLevelRates>,
  ) {
    setDraft((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        [kind]: {
          ...prev.rates[kind],
          [level]: { ...prev.rates[kind][level], ...patch },
        },
      },
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cấu hình hoa hồng</DialogTitle>
          <DialogDescription>
            Chính sách T3.2026 — chỉnh cấp CH, tên CHT / Thu ngân, cấp TVV và đơn giá.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-level">Cấp cửa hàng</Label>
              <select
                id="store-level"
                className="flex h-10 w-full rounded-full border-0 bg-muted px-4 text-sm"
                value={draft.storeLevel}
                onChange={(e) => setDraft((p) => ({ ...p, storeLevel: asLevel(e.target.value) }))}
              >
                {STORE_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    Cấp {lv}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cht-name">Cửa hàng trưởng</Label>
              <Input
                id="cht-name"
                list="cht-name-options"
                placeholder="Tên CHT"
                value={draft.chtName}
                onChange={(e) => setDraft((p) => ({ ...p, chtName: e.target.value }))}
              />
              <datalist id="cht-name-options">
                {employeeNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="cht-trainee"
                checked={draft.chtTrainee}
                onCheckedChange={(checked) =>
                  setDraft((p) => ({ ...p, chtTrainee: checked === true }))
                }
              />
              <Label htmlFor="cht-trainee" className="cursor-pointer font-normal">
                CHT tập sự (hưởng 80% đơn giá)
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashier-name">Thu ngân</Label>
              <Input
                id="cashier-name"
                placeholder="Tên thu ngân"
                value={draft.cashierName}
                onChange={(e) => setDraft((p) => ({ ...p, cashierName: e.target.value }))}
              />
            </div>
          </div>

          {employeeNames.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Cấp tư vấn viên</p>
              <div className="overflow-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-lavender-soft/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Nhân viên</th>
                      <th className="px-3 py-2 font-medium">Cấp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeNames.map((name) => (
                      <tr key={name} className="border-t border-border/40">
                        <td className="px-3 py-2">{name}</td>
                        <td className="px-3 py-2">
                          <select
                            className="h-8 rounded-lg border-0 bg-muted px-2 text-sm"
                            value={draft.tvvLevels[name] ?? 3}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                tvvLevels: { ...p.tvvLevels, [name]: asLevel(e.target.value) },
                              }))
                            }
                          >
                            {STORE_LEVELS.map((lv) => (
                              <option key={lv} value={lv}>
                                Cấp {lv}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <RateTable
            title="Đơn giá cửa hàng trưởng"
            unitHint="Tích trữ / TS24k: đồng trên chỉ. TS Khác: % trên doanh thu (0.18 = 0,18%)."
            rows={draft.rates.cht}
            onChange={(level, patch) => patchRates("cht", level, patch)}
          />
          <RateTable
            title="Đơn giá tư vấn viên"
            unitHint="Tích trữ / TS24k: đồng trên chỉ. TS Khác: % trên doanh thu (0.90 = 0,90%)."
            rows={draft.rates.tvv}
            onChange={(level, patch) => patchRates("tvv", level, patch)}
          />

          <div>
            <p className="mb-2 text-sm font-semibold">Mức hoa hồng thu ngân (đồng / tháng)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STORE_LEVELS.map((level) => (
                <div key={level} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cấp {level}</Label>
                  <Input
                    type="number"
                    className="h-8 rounded-lg text-right"
                    value={draft.rates.cashier[level]}
                    onChange={(e) => {
                      const n = parseNum(e.target.value);
                      setDraft((p) => ({
                        ...p,
                        rates: {
                          ...p.rates,
                          cashier: { ...p.rates.cashier, [level]: n },
                        },
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft({
                ...createDefaultCommissionConfig(),
                chtName: draft.chtName,
                cashierName: draft.cashierName,
                tvvLevels: draft.tvvLevels,
                rates: cloneDefaultRates(),
              })
            }
          >
            <RotateCcw className="h-4 w-4" />
            Khôi phục mặc định T3.2026
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Lưu cấu hình
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
