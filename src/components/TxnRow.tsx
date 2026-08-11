import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, StickyNote } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TxnDialog, type TxnKind } from "@/components/TxnDialog";
import { VerifyDialog } from "@/components/AppLock";
import { formatTime, formatDateShort } from "@/lib/format";
import { Money } from "@/components/Riyal";
import { deleteTxn, getState, type Txn } from "@/lib/store";

export function TxnRow({
  txn,
  kind,
  name,
  clientId,
  showDate = false,
}: {
  txn: Txn;
  kind: TxnKind;
  name: string;
  clientId?: string;
  showDate?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [verify, setVerify] = useState<"edit" | "delete" | null>(null);
  const isDebt = kind === "debt";
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiped = useRef(false);

  /** السحب لليسار = تعديل، السحب لليمين = حذف — مع احترام حماية العمليات */
  function trigger(action: "edit" | "delete") {
    const s = getState().settings;
    const needsPin =
      s.sensitiveLock &&
      !!s.pin &&
      (action === "edit" ? s.sensitiveEdit : s.sensitiveDelete);
    if (needsPin) {
      setVerify(action);
      return;
    }
    if (action === "edit") setEdit(true);
    else setConfirm(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl" data-no-swipe>
      {/* يظهر خلف البطاقة حسب اتجاه السحب فقط */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex w-28 items-center justify-center gap-1 bg-secondary text-sm font-bold"
        style={{ opacity: dx < 0 ? 1 : 0 }}
      >
        <Pencil className="size-4" /> تعديل
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex w-28 items-center justify-center gap-1 bg-destructive/10 text-sm font-bold text-destructive"
        style={{ opacity: dx > 0 ? 1 : 0 }}
      >
        <Trash2 className="size-4" /> حذف
      </div>
    <div
      style={{ transform: `translateX(${dx}px)` }}
      className="card-soft relative flex touch-pan-y items-center gap-3 p-3 select-none active:bg-secondary/40"
      onPointerDown={(e) => {
        startX.current = e.clientX;
        startY.current = e.clientY;
        swiped.current = false;
      }}
      onPointerMove={(e) => {
        if (startX.current === null || startY.current === null) return;
        const mx = e.clientX - startX.current;
        const my = e.clientY - startY.current;
        if (Math.abs(mx) > 8) swiped.current = true;
        if (Math.abs(mx) > Math.abs(my)) setDx(Math.max(-140, Math.min(140, mx)));
      }}
      onPointerUp={() => {
        const moved = dx;
        startX.current = null;
        startY.current = null;
        setDx(0);
        if (moved <= -90) trigger("edit");
        else if (moved >= 90) trigger("delete");
      }}
      onPointerLeave={() => {
        setDx(0);
        startX.current = null;
      }}
      onPointerCancel={() => {
        setDx(0);
        startX.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {clientId ? (
            <Link
              to="/client/$id"
              params={{ id: clientId }}
              className="truncate font-semibold hover:underline"
              onClick={(e) => {
                if (swiped.current || dx !== 0) e.preventDefault();
              }}
            >
              {name}
            </Link>
          ) : (
            <span className="truncate font-semibold">{name}</span>
          )}
          {txn.note ? <StickyNote className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        </div>
        <p className="num mt-0.5 text-xs text-muted-foreground">
          {showDate ? `${formatDateShort(txn.at)} · ` : ""}
          {formatTime(txn.at)}
        </p>
        {txn.note ? <p className="mt-1 text-xs text-muted-foreground">{txn.note}</p> : null}
        {txn.photos && txn.photos.length > 0 ? (
          <div className="mt-2 flex gap-1.5">
            {txn.photos.map((p, i) => (
              <img
                key={i}
                src={p}
                alt="مرفق"
                className="size-12 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>

      <span
        className={`shrink-0 text-base font-bold ${isDebt ? "text-destructive" : "text-success"}`}
      >
        <span className="num">{isDebt ? "+" : "−"}</span>
        <Money value={txn.amount} />
      </span>

      <TxnDialog open={edit} onOpenChange={setEdit} kind={kind} txn={txn} />

      <VerifyDialog
        open={verify !== null}
        onOpenChange={(v) => !v && setVerify(null)}
        title={verify === "edit" ? "تأكيد تعديل العملية" : "تأكيد حذف العملية"}
        onSuccess={() => {
          if (verify === "edit") setEdit(true);
          else setConfirm(true);
          setVerify(null);
        }}
      />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العملية؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذفها من القسم الخاص بها ومن التقارير.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteTxn(kind, txn.id);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
