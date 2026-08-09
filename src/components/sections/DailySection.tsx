import { useMemo, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { TxnRow } from "@/components/TxnRow";
import { formatMoney } from "@/lib/format";
import { dayKey, todayKey, useAppState, clientName } from "@/lib/store";
import { Money } from "@/components/Riyal";

export function DailySection() {
  const state = useAppState();
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayKey();

  const groups = useMemo(() => {
    const debts = state.debts.filter((d) => d.scope === "daily" && dayKey(d.at) === today);
    const map = new Map<string, typeof debts>();
    for (const d of debts) {
      const list = map.get(d.clientId) ?? [];
      list.push(d);
      map.set(d.clientId, list);
    }
    return Array.from(map.entries())
      .map(([clientId, txns]) => {
        const total = txns.reduce((a, t) => a + t.amount, 0);
        const paidToday = state.payments
          .filter((p) => p.clientId === clientId && p.scope === "daily" && dayKey(p.at) === today)
          .reduce((a, t) => a + t.amount, 0);
        return {
          clientId,
          txns: txns.sort((a, b) => +new Date(b.at) - +new Date(a.at)),
          total,
          paidToday,
        };
      })
      .filter((g) => g.paidToday < g.total)
      .sort(
        (a, b) => +new Date(b.txns[0]?.at ?? 0) - +new Date(a.txns[0]?.at ?? 0),
      );
  }, [state, today]);

  const dayTotal = groups.reduce((a, g) => a + g.total - g.paidToday, 0);

  return (
    <div className="space-y-4">
      <div className="card-soft bg-primary p-4 text-primary-foreground">
        <p className="text-sm opacity-90">إجمالي ديون اليوم</p>
        <p className="num mt-1 text-3xl font-extrabold"><Money value={dayTotal} /></p>
        <p className="mt-1 text-xs opacity-80">
          {groups.length} عميل · {groups.reduce((a, g) => a + g.txns.length, 0)} عملية
        </p>
      </div>

      {groups.length === 0 && (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="لا توجد ديون اليوم"
          hint="اضغط زر + لإضافة دين جديد"
        />
      )}

      {groups.map((g) => {
        const open = openId === g.clientId;
        return (
          <div key={g.clientId} className="card-soft overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : g.clientId)}
              className="flex w-full items-center gap-3 p-4 text-right"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{clientName(state, g.clientId)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.txns.length} عملية
                  {g.paidToday > 0 ? ` · سُدد اليوم ${formatMoney(g.paidToday)} \uFDFC` : ""}
                </p>
              </div>
              <span className="num text-xl font-extrabold text-destructive">
                <Money value={g.total} />
              </span>
              <ChevronDown
                className={`size-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <div className="space-y-2 border-t border-border bg-muted/40 p-3">
                {g.txns.map((t) => (
                  <TxnRow
                    key={t.id}
                    txn={t}
                    kind="debt"
                    name={clientName(state, g.clientId)}
                    clientId={g.clientId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-2 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
