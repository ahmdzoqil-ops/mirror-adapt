import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  HandCoins,
  Minus,
  Plus,
  Settings as SettingsIcon,
  Users,
  Wallet,
} from "lucide-react";
import { AppLock } from "@/components/AppLock";
import { AlertsCenter } from "@/components/AlertsCenter";
import { SplashScreen } from "@/components/SplashScreen";
import { TxnDialog, type TxnKind } from "@/components/TxnDialog";
import { DailySection } from "@/components/sections/DailySection";
import { DebtorsSection } from "@/components/sections/DebtorsSection";
import { PaymentsSection } from "@/components/sections/PaymentsSection";
import { ReportsSection } from "@/components/sections/ReportsSection";
import { SettingsSection } from "@/components/sections/SettingsSection";
import { loadState } from "@/lib/store";
import { startReminderLoop } from "@/lib/notify";
import { startBackupLoop } from "@/lib/backup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "دفتري — إدارة الديون والسداد بدون إنترنت" },
      {
        name: "description",
        content:
          "دفتري: تطبيق عربي لإدارة الديون اليومية والمديونية والسداد مع تقارير سنوية، يعمل بالكامل على جهازك بدون إنترنت.",
      },
      { property: "og:title", content: "دفتري — إدارة الديون والسداد" },
      {
        property: "og:description",
        content: "سجّل الديون والسداد، وتابع مديونية العملاء والتقارير اليومية بدون إنترنت.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "daily", label: "اليومية", icon: Wallet },
  { id: "debtors", label: "المديونية", icon: Users },
  { id: "payments", label: "السداد", icon: HandCoins },
  { id: "reports", label: "التقارير", icon: CalendarDays },
  { id: "settings", label: "الإعدادات", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** شاشة البدء تُعرض مرة واحدة فقط عند تشغيل التطبيق (لا تتكرر عند الرجوع) */
let splashShown = false;

function Index() {
  const [tab, setTab] = useState<TabId>("daily");
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(!splashShown);
  const [fabOpen, setFabOpen] = useState(false);
  const [dialog, setDialog] = useState<TxnKind | null>(null);
  const swipe = useRef<{ x: number; y: number; ok: boolean } | null>(null);

  useEffect(() => {
    loadState();
    setReady(true);
    const stopReminders = startReminderLoop();
    const stopBackups = startBackupLoop();
    return () => {
      stopReminders();
      stopBackups();
    };
  }, []);

  if (!ready) return <div className="min-h-screen bg-background" />;

  /** التنقل بين الأقسام بالسحب الأفقي الواضح فقط */
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    const el = e.target as HTMLElement;
    const blocked = !!el.closest("[data-no-swipe],input,textarea,select,[role='dialog']");
    swipe.current = { x: t.clientX, y: t.clientY, ok: !blocked };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!s || !s.ok || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const idx = TABS.findIndex((x) => x.id === tab);
    const next = dx < 0 ? idx + 1 : idx - 1;
    const target = TABS[next];
    if (target) setTab(target.id);
  }

  return (
    <AppLock>
      {splash && (
        <SplashScreen
          onDone={() => {
            splashShown = true;
            setSplash(false);
          }}
        />
      )}
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-primary">دفتري</h1>
            <p className="text-xs text-muted-foreground">
              {TABS.find((t) => t.id === tab)?.label}
            </p>
          </div>
          <AlertsCenter />
        </header>


        <main
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="mx-auto max-w-2xl animate-in fade-in-0 duration-200 p-4"
        >
          {tab === "daily" && <DailySection />}
          {tab === "debtors" && <DebtorsSection />}
          {tab === "payments" && <PaymentsSection />}
          {tab === "reports" && <ReportsSection />}
          {tab === "settings" && <SettingsSection />}
        </main>

        {/* زر الإضافة العائم */}
        {tab !== "settings" && (
        <div className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          {fabOpen && (
            <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
              <button
                onClick={() => {
                  setDialog("debt");
                  setFabOpen(false);
                }}
                className="flex items-center gap-2 rounded-full bg-destructive px-5 py-3 font-bold text-destructive-foreground shadow-lg"
              >
                <Plus className="size-4" /> إضافة دين
              </button>
              <button
                onClick={() => {
                  setDialog("payment");
                  setFabOpen(false);
                }}
                className="flex items-center gap-2 rounded-full bg-success px-5 py-3 font-bold text-success-foreground shadow-lg"
              >
                <Minus className="size-4" /> إضافة سداد
              </button>
            </div>
          )}
          <button
            aria-label="إضافة"
            onClick={() => setFabOpen((v) => !v)}
            className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-95"
          >
            <Plus className={`size-8 transition-transform ${fabOpen ? "rotate-45" : ""}`} />
          </button>
        </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
          <div className="mx-auto flex max-w-2xl">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        <TxnDialog
          open={dialog !== null}
          onOpenChange={(v) => !v && setDialog(null)}
          kind={dialog ?? "debt"}
        />
      </div>
    </AppLock>
  );
}
