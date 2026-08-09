import { useMemo, useState } from "react";
import { HandCoins, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TxnRow } from "@/components/TxnRow";
import { EmptyState } from "@/components/sections/DailySection";
import { formatMoney, formatDate } from "@/lib/format";
import { matchScore } from "@/lib/arabic";
import { clientName, dayKey, useAppState } from "@/lib/store";
import { Money } from "@/components/Riyal";

export function PaymentsSection() {
  const state = useAppState();
  const [query, setQuery] = useState("");

  const days = useMemo(() => {
    let list = [...state.payments];
    if (query.trim()) {
      list = list
        .map((p) => ({ p, score: matchScore(query, clientName(state, p.clientId)) }))
        .filter((r) => r.score > 0.45)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.p);
    }
    list.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    const map = new Map<string, typeof list>();
    for (const p of list) {
      const k = dayKey(p.at);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [state, query]);

  const total = state.payments.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="card-soft bg-success p-4 text-success-foreground">
        <p className="text-sm opacity-90">إجمالي السداد</p>
        <p className="num mt-1 text-3xl font-extrabold"><Money value={total} /></p>
        <p className="mt-1 text-xs opacity-80">{state.payments.length} عملية</p>
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث باسم العميل"
          className="pr-9"
        />
      </div>

      {days.length === 0 && (
        <EmptyState
          icon={<HandCoins className="size-6" />}
          title="لا توجد عمليات سداد"
          hint="أضف سدادًا من زر +"
        />
      )}

      {days.map(([key, list]) => (
        <div key={key} className="space-y-2">
          <p className="px-1 text-sm font-semibold text-muted-foreground">
            {formatDate(list[0]!.at)}
          </p>
          {list.map((p) => (
            <TxnRow
              key={p.id}
              txn={p}
              kind="payment"
              name={clientName(state, p.clientId)}
              clientId={p.clientId}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
