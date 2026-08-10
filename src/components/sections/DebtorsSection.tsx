import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Contact, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoInput } from "@/components/PhotoInput";
import { ClientAvatar } from "@/components/ClientAvatar";
import { EmptyState } from "@/components/sections/DailySection";
import { formatMoney } from "@/lib/format";
import { matchScore } from "@/lib/arabic";
import { pickContactDetailed } from "@/lib/contacts";

import { addClient, balanceOf, isDebtor, setArchived, useAppState } from "@/lib/store";
import { Money } from "@/components/Riyal";

export function DebtorsSection() {
  const state = useAppState();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<"active" | "archive">("active");

  const debtors = useMemo(() => {
    const list = state.clients
      .filter((c) => isDebtor(state, c) && c.archived !== true)
      .map((c) => ({ client: c, balance: balanceOf(state, c.id) }));
    if (!query.trim()) return list.sort((a, b) => b.balance - a.balance);
    return list
      .map((r) => ({ ...r, score: matchScore(query, r.client.name) }))
      .filter((r) => r.score > 0.45)
      .sort((a, b) => b.score - a.score || b.balance - a.balance);
  }, [state, query]);

  const total = debtors.reduce((a, d) => a + d.balance, 0);
  const archived = state.clients.filter((c) => c.archived === true);

  if (view === "archive") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("active")}
          className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold"
        >
          رجوع إلى المديونية
        </button>
        <div className="card-soft p-4">
          <p className="text-sm text-muted-foreground">العملاء المؤرشفون</p>
          <p className="num mt-1 text-3xl font-extrabold">{archived.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            الأرشفة لا تحذف العميل ولا ديونه ولا تغيّر رصيده أو التقارير.
          </p>
        </div>
        {archived.length === 0 && (
          <EmptyState
            icon={<Archive className="size-6" />}
            title="الأرشيف فارغ"
            hint="يمكنك أرشفة أي عميل من صفحته"
          />
        )}
        {archived.map((c) => (
          <div key={c.id} className="card-soft space-y-3 p-3">
            <Link
              to="/client/$id"
              params={{ id: c.id }}
              className="flex items-center gap-3"
            >
              <ClientAvatar name={c.name} photo={c.photo} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.name}</p>
                {c.phone && <p className="num text-xs text-muted-foreground">{c.phone}</p>}
              </div>
              <span className="num text-base font-extrabold text-destructive">
                <Money value={balanceOf(state, c.id)} />
              </span>
            </Link>
            <button
              onClick={() => {
                setArchived(c.id, false);
                toast.success("تمت إعادة العميل إلى المديونية");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary p-3 text-sm font-semibold"
            >
              <ArchiveRestore className="size-4" /> إلغاء الأرشفة
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-soft bg-primary p-4 text-primary-foreground">
        <p className="text-sm opacity-90">إجمالي المديونية</p>
        <p className="num mt-1 text-3xl font-extrabold"><Money value={total} /></p>
        <p className="mt-1 text-xs opacity-80">{debtors.length} عميل</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث باسم العميل"
            className="pr-9"
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> عميل
        </Button>
      </div>

      <button
        onClick={() => setView("archive")}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <Archive className="size-4" /> الأرشيف
        </span>
        <span className="num text-muted-foreground">{archived.length}</span>
      </button>

      {debtors.length === 0 && (
        <EmptyState
          icon={<Users className="size-6" />}
          title="لا يوجد عملاء مدينون"
          hint="أضف عميلًا يدويًا أو سجّل ديونًا"
        />
      )}

      {debtors.map(({ client, balance }) => (
        <Link
          key={client.id}
          to="/client/$id"
          params={{ id: client.id }}
          className="card-soft flex items-center gap-3 p-4 transition-colors active:bg-secondary/60"
        >
          <ClientAvatar name={client.name} photo={client.photo} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{client.name}</p>
            {client.phone && <p className="num text-xs text-muted-foreground">{client.phone}</p>}
          </div>
          <div className="text-left">
            <span
              className={`num text-lg font-extrabold ${balance > 0 ? "text-destructive" : "text-success"}`}
            >
              <Money value={balance} />
            </span>
            {balance <= 0 && (
              <p className="text-[11px] font-semibold text-success">مسدّد</p>
            )}
          </div>
        </Link>
      ))}

      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  function save() {
    if (!name.trim()) {
      toast.error("أدخل اسم العميل");
      return;
    }
    addClient({ name, phone: phone.trim(), photo: photos[0] ?? "" });
    toast.success("تمت إضافة العميل");
    setName("");
    setPhone("");
    setPhotos([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>عميل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cname">الاسم</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cphone">رقم الهاتف (اختياري)</Label>
            <div className="flex gap-2">
              <Input
                id="cphone"
                className="num flex-1"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="اختيار من جهات الاتصال"
                onClick={() => {
                  void (async () => {
                    const res = await pickContactDetailed();
                    if (!res.ok) {
                      if (res.reason === "denied")
                        toast.error("لم يتم السماح بالوصول إلى جهات الاتصال");
                      else if (res.reason === "unsupported")
                        toast.error("جهات الاتصال غير مدعومة على هذا الجهاز");
                      else if (res.reason === "error") toast.error("تعذر فتح جهات الاتصال");
                      return;
                    }
                    if (res.contact.phone) setPhone(res.contact.phone);
                    if (res.contact.name && !name.trim()) setName(res.contact.name);
                  })();
                }}
              >
                <Contact className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>الصورة (اختياري)</Label>
            <PhotoInput photos={photos} onChange={setPhotos} single />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
