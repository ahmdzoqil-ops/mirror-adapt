import { useMemo, useState } from "react";
import { CalendarDays, FileText, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/ReportDialog";
import { buildRangeReport, type ReportData } from "@/lib/report";
import { TxnRow } from "@/components/TxnRow";
import { EmptyState } from "@/components/sections/DailySection";
import { ClientAvatar } from "@/components/ClientAvatar";
import { formatDate, formatMoney } from "@/lib/format";
import { matchScore } from "@/lib/arabic";
import { clientName, dayKey, getState, useAppState, type Txn } from "@/lib/store";
import { Money } from "@/components/Riyal";

type Preset = "today" | "week" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
  { id: "custom", label: "فترة مخصصة" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeFor(preset: Preset, from: string, to: string) {
  const now = new Date();
  if (preset === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === "week") {
    const s = startOfDay(now);
    s.setDate(s.getDate() - 6);
    return { start: s, end: endOfDay(now) };
  }
  if (preset === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
  }
  const s = from ? startOfDay(new Date(from)) : startOfDay(new Date(now.getFullYear(), 0, 1));
  const e = to ? endOfDay(new Date(to)) : endOfDay(now);
  return { start: s, end: e };
}

type DayGroup = { key: string; at: string; items: { t: Txn; kind: "debt" | "payment" }[] };

export function ReportsSection() {
  const state = useAppState();
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  const { start, end } = rangeFor(preset, from, to);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { groups, totalDebt, totalPay, clientsCount, count } = useMemo(() => {
    const inRange = (t: Txn) =>
      t.at >= startIso && t.at <= endIso && (!clientId || t.clientId === clientId);
    const debts = state.debts.filter(inRange);
    const payments = state.payments.filter(inRange);

    const map = new Map<string, DayGroup>();
    const push = (t: Txn, kind: "debt" | "payment") => {
      const key = dayKey(t.at);
      const g = map.get(key) ?? { key, at: t.at, items: [] };
      g.items.push({ t, kind });
      map.set(key, g);
    };
    debts.forEach((t) => push(t, "debt"));
    payments.forEach((t) => push(t, "payment"));

    const list = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
    list.forEach((g) => g.items.sort((a, b) => +new Date(b.t.at) - +new Date(a.t.at)));

    const ids = new Set([...debts, ...payments].map((t) => t.clientId));
    return {
      groups: list,
      totalDebt: debts.reduce((a, t) => a + t.amount, 0),
      totalPay: payments.reduce((a, t) => a + t.amount, 0),
      clientsCount: ids.size,
      count: debts.length + payments.length,
    };
  }, [state, startIso, endIso, clientId]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim();
    const list = state.clients;
    if (!q) return list.slice(0, 30);
    return list
      .map((c) => ({ c, s: matchScore(q, c.name) }))
      .filter((r) => r.s > 0.45)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((r) => r.c);
  }, [state.clients, clientQuery]);

  const activeClient = clientId ? state.clients.find((c) => c.id === clientId) : undefined;
  const rangeTitle = activeClient
    ? `كشف حساب ${activeClient.name}`
    : `تقرير ${PRESETS.find((p) => p.id === preset)?.label ?? "الفترة"}`;

  return (
    <div className="space-y-4">
      {/* الفلاتر */}
      <div className="card-soft space-y-3 p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                preset === p.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">من</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-right text-sm font-semibold"
        >
          <Users className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate">{activeClient ? activeClient.name : "جميع العملاء"}</span>
          {activeClient && (
            <X
              className="size-4 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setClientId(null);
                setPickerOpen(false);
              }}
            />
          )}
        </button>

        {pickerOpen && (
          <div className="space-y-2 rounded-lg border border-border p-2">
            <Input
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              placeholder="ابحث عن عميل"
            />
            <div className="max-h-52 space-y-1 overflow-y-auto">
              <button
                onClick={() => {
                  setClientId(null);
                  setPickerOpen(false);
                }}
                className="w-full rounded-lg p-2 text-right text-sm font-semibold hover:bg-secondary"
              >
                جميع العملاء
              </button>
              {clientMatches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-right text-sm hover:bg-secondary"
                >
                  <ClientAvatar name={c.name} photo={c.photo} size="sm" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
              {clientMatches.length === 0 && (
                <p className="p-2 text-center text-xs text-muted-foreground">لا توجد نتائج</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* الملخص */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="إجمالي الديون" value={totalDebt} tone="debt" />
        <SummaryCard label="إجمالي السداد" value={totalPay} tone="pay" />
        <SummaryCard label="المتبقي" value={totalDebt - totalPay} tone="net" />
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        {count} عملية · {clientsCount} عميل
      </p>

      <Button
        className="w-full"
        onClick={() =>
          setReport(buildRangeReport(getState(), startIso, endIso, rangeTitle, clientId ?? undefined))
        }
      >
        <FileText className="size-4" /> تصدير التقرير PDF
      </Button>

      {groups.length === 0 && (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title="لا توجد عمليات في هذه الفترة"
          hint="غيّر الفترة أو العميل لعرض نتائج أخرى"
        />
      )}

      {groups.map((g) => {
        const debt = g.items.filter((i) => i.kind === "debt").reduce((a, i) => a + i.t.amount, 0);
        const pay = g.items.filter((i) => i.kind === "payment").reduce((a, i) => a + i.t.amount, 0);
        return (
          <div key={g.key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <p className="flex-1 truncate text-sm font-bold">{formatDate(g.at)}</p>
              <span className="num text-xs font-bold text-destructive"><Money value={debt} /></span>
              <span className="num text-xs font-bold text-success"><Money value={pay} /></span>
            </div>
            {g.items.map(({ t, kind }) => (
              <TxnRow
                key={t.id}
                txn={t}
                kind={kind}
                name={clientName(state, t.clientId)}
                clientId={t.clientId}
              />
            ))}
          </div>
        );
      })}

      <ReportDialog
        open={report !== null}
        onOpenChange={(v) => !v && setReport(null)}
        data={report}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "debt" | "pay" | "net";
}) {
  const color =
    tone === "debt"
      ? "text-destructive"
      : tone === "pay"
        ? "text-success"
        : value > 0
          ? "text-destructive"
          : "text-success";
  return (
    <div className="card-soft p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-base font-extrabold ${color}`}><Money value={value} /></p>
    </div>
  );
}
