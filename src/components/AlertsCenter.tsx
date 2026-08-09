import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { activeAlerts, alertIntervalLabel, useAppState } from "@/lib/store";
import { Money } from "@/components/Riyal";

function relative(iso: string) {
  const diff = +new Date(iso) - Date.now();
  const days = Math.round(diff / 86400000);
  if (diff <= 0) return "مستحق الآن";
  if (days <= 0) return "اليوم";
  if (days === 1) return "غدًا";
  return `بعد ${days} أيام`;
}

export function AlertsCenter() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const alerts = activeAlerts(state);
  const dueCount = alerts.filter((a) => a.due).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="مركز التنبيهات"
        className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary"
      >
        {dueCount > 0 ? (
          <BellRing className="size-6 text-primary" />
        ) : (
          <Bell className="size-6" />
        )}
        {alerts.length > 0 && (
          <span className="num absolute -top-0.5 -left-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {alerts.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-5" /> التنبيهات النشطة
            </DialogTitle>
          </DialogHeader>

          {alerts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد تنبيهات نشطة — أضف تذكيرًا من صفحة العميل.
            </p>
          )}

          <div className="space-y-2">
            {alerts.map((a) => (
              <button
                key={a.rule.id}
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/client/$id", params: { id: a.client.id } });
                }}
                className={`w-full rounded-xl border p-3 text-right transition-colors ${
                  a.due ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-bold">{a.client.name}</p>
                  <p className="num shrink-0 font-extrabold text-destructive">
                    <Money value={a.remaining} />
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className={a.due ? "font-bold text-primary" : ""}>
                    <Clock className="ml-1 inline size-3" />
                    {relative(a.rule.nextAt)}
                  </span>
                  <span>{alertIntervalLabel(a.rule.everyDays)}</span>
                  <span className="font-semibold text-destructive">دين مستحق</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
