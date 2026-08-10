import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, CalendarClock, Clock, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  alertIntervalLabel,
  bellItems,
  dismissNotification,
  useAppState,
  type BellItem,
} from "@/lib/store";
import { Money } from "@/components/Riyal";

function relative(iso: string) {
  const diff = +new Date(iso) - Date.now();
  const days = Math.round(diff / 86400000);
  if (diff <= 0) return "مستحق الآن";
  if (days <= 0) return "اليوم";
  if (days === 1) return "غدًا";
  return `بعد ${days} أيام`;
}

/** بطاقة تنبيه قابلة للسحب لليسار لإخفائها من الجرس فقط */
function AlertCard({ item, onOpen }: { item: BellItem; onOpen: () => void }) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-destructive/10 text-xs font-bold text-destructive">
        <X className="size-4" /> إخفاء
      </div>
      <button
        onPointerDown={(e) => {
          startX.current = e.clientX;
          moved.current = false;
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const d = e.clientX - startX.current;
          if (Math.abs(d) > 6) moved.current = true;
          setDx(Math.min(0, d));
        }}
        onPointerUp={() => {
          if (dx < -80) dismissNotification(item.key);
          else setDx(0);
          startX.current = null;
        }}
        onPointerCancel={() => {
          setDx(0);
          startX.current = null;
        }}
        onClick={() => {
          if (!moved.current) onOpen();
        }}
        style={{ transform: `translateX(${dx}px)` }}
        className={`relative w-full touch-pan-y rounded-xl border p-3 text-right transition-colors ${
          item.due ? "border-primary/40 bg-primary/5" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-bold">{item.clientName}</p>
          <p className="num shrink-0 font-extrabold text-destructive">
            <Money value={item.amount} />
          </p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{item.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.nextAt && (
            <span className={item.due ? "font-bold text-primary" : ""}>
              <Clock className="ml-1 inline size-3" />
              {relative(item.nextAt)}
            </span>
          )}
          {item.everyDays && <span>{alertIntervalLabel(item.everyDays)}</span>}
        </div>
      </button>
    </div>
  );
}

export function AlertsCenter() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const items = bellItems(state);
  const daily = items.filter((i) => i.group === "daily");
  const ledger = items.filter((i) => i.group === "ledger");
  const dueCount = items.filter((i) => i.due).length;

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
        {items.length > 0 && (
          <span className="num absolute -top-0.5 -left-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {items.length}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-5" /> التنبيهات
            </DialogTitle>
          </DialogHeader>

          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد تنبيهات حاليًا — أضف تذكيرًا من صفحة العميل.
            </p>
          )}

          {daily.length > 0 && (
            <section className="space-y-2">
              <p className="flex items-center gap-2 border-b border-border pb-1 text-xs font-bold text-primary">
                <CalendarClock className="size-4" /> تنبيهات اليوم ({daily.length})
              </p>
              {daily.map((i) => (
                <AlertCard
                  key={i.key}
                  item={i}
                  onOpen={() => {
                    setOpen(false);
                    void navigate({ to: "/client/$id", params: { id: i.clientId } });
                  }}
                />
              ))}
            </section>
          )}

          {ledger.length > 0 && (
            <section className="space-y-2">
              <p className="flex items-center gap-2 border-b border-border pb-1 text-xs font-bold text-primary">
                <Users className="size-4" /> تنبيهات المديونية ({ledger.length})
              </p>
              {ledger.map((i) => (
                <AlertCard
                  key={i.key}
                  item={i}
                  onOpen={() => {
                    setOpen(false);
                    void navigate({ to: "/client/$id", params: { id: i.clientId } });
                  }}
                />
              ))}
            </section>
          )}

          {items.length > 0 && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              اسحب التنبيه إلى اليسار لإخفائه من هذه القائمة فقط — إعدادات تنبيه العميل تبقى كما هي.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
