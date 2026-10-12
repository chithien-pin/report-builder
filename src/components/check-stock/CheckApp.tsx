"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatasetsScreen } from "@/components/check-stock/DatasetsScreen";
import { LinesScreen } from "@/components/check-stock/LinesScreen";
import { SessionScreen } from "@/components/check-stock/SessionScreen";
import { UngroupedScreen } from "@/components/check-stock/UngroupedScreen";
import { ApiError, stockApi } from "@/lib/check-stock/api";
import { buildCsv } from "@/lib/check-stock/csv";
import { nowTime, sessionKey, todayIso } from "@/lib/check-stock/format";
import { summarize } from "@/lib/check-stock/match";
import {
  RevConflict,
  type CategoryId,
  type CountLine,
  type DatasetFile,
  type DatasetsIndex,
  type LinesFile,
  type SessionDoc,
  type SessionListItem,
  type SystemRow,
} from "@/lib/check-stock/types";

type Screen = "session" | "lines" | "ungrouped" | "datasets";

type ConflictState =
  | { kind: "session"; current: SessionDoc; local: SessionDoc }
  | { kind: "lines"; current: LinesFile };

export function CheckApp() {
  const [screen, setScreen] = useState<Screen>("session");
  const [linesFile, setLinesFile] = useState<LinesFile | null>(null);
  const [index, setIndex] = useState<DatasetsIndex | null>(null);
  const [datasets, setDatasets] = useState<Record<string, DatasetFile>>({});
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [category, setCategory] = useState<CategoryId>("loai1");
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("Chưa mở phiên");
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [ready, setReady] = useState(false);
  const [browseDate, setBrowseDate] = useState(todayIso);
  const revRef = useRef(0);
  const pendingRef = useRef<SessionDoc | null>(null);
  const savingRef = useRef(false);
  const holdRef = useRef(false);
  const timerRef = useRef<number>(0);

  const cacheRef = useRef<Record<string, DatasetFile>>({});

  async function loadDataset(id: string | null | undefined) {
    if (!id) return null;
    const cached = cacheRef.current[id];
    if (cached) return cached;
    const file = await stockApi.dataset(id);
    cacheRef.current = { ...cacheRef.current, [id]: file };
    setDatasets((current) => ({ ...current, [id]: file }));
    return file;
  }

  function rememberDataset(file: DatasetFile) {
    cacheRef.current = { ...cacheRef.current, [file.id]: file };
    setDatasets((current) => ({ ...current, [file.id]: file }));
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [lines, list, sessionList] = await Promise.all([
          stockApi.lines(),
          stockApi.datasets(),
          stockApi.sessions(),
        ]);
        if (cancelled) return;
        setLinesFile(lines);
        setIndex(list);
        setSessions(sessionList.items);
        if (list.activeId) {
          const file = await stockApi.dataset(list.activeId);
          if (!cancelled) rememberDataset(file);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flushSession = async () => {
    if (savingRef.current || holdRef.current) return;
    const doc = pendingRef.current;
    if (!doc) return;
    pendingRef.current = null;
    savingRef.current = true;
    setSaveState("Đang lưu…");
    try {
      const saved = await stockApi.saveSession(doc.category, doc.id, doc, revRef.current);
      revRef.current = saved.rev;
      setSession((current) => (current && current.id === saved.id ? { ...current, rev: saved.rev, updatedAt: saved.updatedAt } : current));
      setSaveState("Đã lưu");
      const listed = await stockApi.sessions();
      setSessions(listed.items);
    } catch (caught) {
      pendingRef.current = doc;
      if (caught instanceof RevConflict) {
        holdRef.current = true;
        setConflict({ kind: "session", current: caught.current as SessionDoc, local: doc });
        setSaveState("Có bản khác mới hơn");
      } else {
        setSaveState("Chưa lưu được");
        setError(caught instanceof Error ? caught.message : "Không lưu được phiên.");
      }
    } finally {
      savingRef.current = false;
      if (pendingRef.current && !holdRef.current) void flushSession();
    }
  };

  function patchSession(recipe: (doc: SessionDoc) => SessionDoc, immediate = false) {
    setSession((current) => {
      if (!current) return current;
      const next = recipe(current);
      pendingRef.current = next;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flushSession(), immediate ? 0 : 400);
      return next;
    });
  }

  async function openSession(nextCategory: CategoryId, date: string, ca: string) {
    if (pendingRef.current) await flushSession();
    const key = sessionKey(date, ca || "1");
    try {
      const existing = await stockApi.session(nextCategory, key);
      const doc: SessionDoc = existing ?? {
        rev: 0,
        id: key,
        category: nextCategory,
        datasetId: index?.activeId ?? "",
        date,
        time: nowTime(),
        ca: ca || "1",
        inspector: "",
        controller: "",
        cells: {},
        weightOverride: {},
        notes: {},
        updatedAt: new Date().toISOString(),
      };
      revRef.current = doc.rev;
      pendingRef.current = null;
      holdRef.current = false;
      setCategory(nextCategory);
      setSession(doc);
      setSaveState(doc.rev ? "Đã mở" : "Phiên mới");
      if (doc.datasetId) await loadDataset(doc.datasetId);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không mở được phiên.");
    }
  }

  async function saveLines(next: CountLine[], qtyTolerance: number) {
    if (!linesFile) return;
    try {
      const saved = await stockApi.saveLines(next, qtyTolerance, linesFile.rev);
      setLinesFile(saved);
    } catch (caught) {
      if (caught instanceof RevConflict) {
        setConflict({ kind: "lines", current: caught.current as LinesFile });
        throw new Error("Quy tắc vừa được người khác lưu. Hãy tải lại.");
      }
      throw caught;
    }
  }

  const activeRows: SystemRow[] = index?.activeId ? datasets[index.activeId]?.rows ?? [] : [];
  const sessionRows: SystemRow[] = session?.datasetId ? datasets[session.datasetId]?.rows ?? [] : [];
  const ungrouped = summarize(sessionRows.length ? sessionRows : activeRows, linesFile?.lines ?? []).ungrouped;

  async function exportSession() {
    if (!session || !linesFile) return;
    const built = buildCsv(linesFile.lines, session, sessionRows, linesFile.qtyTolerance);
    const blob = new Blob([built.text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = built.filename;
    link.click();
    URL.revokeObjectURL(url);
    patchSession((doc) => ({ ...doc, lastExportedAt: new Date().toISOString() }), true);
  }

  if (!ready || !linesFile || !index) {
    return <main className="px-4 py-10 text-sm text-muted-foreground">{error ?? "Đang mở phiếu kiểm đếm…"}</main>;
  }

  return (
    <main className="mx-auto flex min-h-full max-w-[1400px] flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-medium">Kiểm đếm hàng hóa</h1>
          <p className="text-sm text-muted-foreground">Ba phiên độc lập, một file tồn hệ thống.</p>
        </div>
        <nav className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant={screen === "session" ? "default" : "outline"} onClick={() => setScreen("session")}>Phiên</Button>
          <Button size="sm" variant={screen === "lines" ? "default" : "outline"} onClick={() => setScreen("lines")}>Dòng & đầu mã</Button>
          <Button size="sm" variant={screen === "ungrouped" ? "default" : "outline"} onClick={() => setScreen("ungrouped")}>
            Chưa có nhóm ({ungrouped.codes})
          </Button>
          <Button size="sm" variant={screen === "datasets" ? "default" : "outline"} onClick={() => setScreen("datasets")}>Dữ liệu hệ thống</Button>
        </nav>
      </header>
      {error ? (
        <p className="rounded-xl bg-coral-soft px-3 py-2 text-sm">
          {error}
          <button type="button" className="ml-3 underline" onClick={() => setError(null)}>Đóng</button>
        </p>
      ) : null}

      {screen === "session" ? (
        <SessionScreen
          category={category}
          session={session}
          sessions={sessions}
          lines={linesFile.lines}
          rows={sessionRows}
          qtyTolerance={linesFile.qtyTolerance}
          activeDatasetId={index.activeId}
          ungrouped={ungrouped}
          saveState={saveState}
          browseDate={browseDate}
          onBrowseDate={setBrowseDate}
          onCategory={(next) => {
            setCategory(next);
            setSession(null);
            setSaveState("Chưa mở phiên");
          }}
          onOpen={(date, ca) => void openSession(category, date, ca)}
          onPatch={patchSession}
          onExport={() => void exportSession()}
          onReset={() => patchSession((doc) => ({ ...doc, cells: {}, notes: {}, weightOverride: {} }))}
          onSwitchDataset={() => {
            if (!index.activeId) return;
            void loadDataset(index.activeId);
            patchSession((doc) => ({ ...doc, datasetId: index.activeId ?? doc.datasetId }));
          }}
          onTolerance={(value) => void saveLines(linesFile.lines, Math.max(0, value)).catch((caught: Error) => setError(caught.message))}
        />
      ) : null}
      {screen === "lines" ? (
        <LinesScreen file={linesFile} rows={activeRows} onSave={saveLines} />
      ) : null}
      {screen === "ungrouped" ? (
        <UngroupedScreen lines={linesFile.lines} rows={activeRows} onSave={(next) => saveLines(next, linesFile.qtyTolerance)} />
      ) : null}
      {screen === "datasets" ? (
        <DatasetsScreen
          index={index}
          lines={linesFile.lines}
          sessionDate={session?.date || browseDate}
          onSave={async (file, meta, activate) => {
            try {
              const saved = await stockApi.saveDataset(file, meta, activate);
              setIndex(saved);
              rememberDataset(file);
              if (file.reportDate && !session) setBrowseDate(file.reportDate);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Không lưu được dataset.");
              throw caught;
            }
          }}
          onActivate={async (id) => {
            try {
              const saved = await stockApi.activateDataset(id, index.rev);
              setIndex(saved);
              await loadDataset(id);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Không đổi được dataset đang dùng.");
              throw caught;
            }
          }}
        />
      ) : null}

      <Dialog open={Boolean(conflict)} onOpenChange={(open) => { if (!open) setConflict(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Có bản mới hơn</DialogTitle>
            <DialogDescription>Người khác vừa lưu. Tải bản trên máy chủ, hoặc ghi đè bằng bản đang mở.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!conflict) return;
                if (conflict.kind === "lines") setLinesFile(conflict.current);
                if (conflict.kind === "session") {
                  holdRef.current = false;
                  pendingRef.current = null;
                  revRef.current = conflict.current.rev;
                  setSession(conflict.current);
                  setSaveState("Đã tải bản mới");
                }
                setConflict(null);
              }}
            >
              Tải bản mới
            </Button>
            <Button
              onClick={() => {
                if (!conflict || conflict.kind !== "session") {
                  setConflict(null);
                  return;
                }
                holdRef.current = false;
                revRef.current = conflict.current.rev;
                pendingRef.current = conflict.local;
                setConflict(null);
                void flushSession();
              }}
            >
              Ghi đè
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
