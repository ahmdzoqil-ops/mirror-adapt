import { getState, replaceState, type AppState } from "@/lib/store";

const KEY = "daftar-backups-v1";
const MAX_AUTO = 7;

export type BackupMeta = {
  id: string;
  at: string;
  size: number;
  kind: "auto" | "manual";
  ok: boolean;
};

type BackupRecord = BackupMeta & { data: string };

function read(): BackupRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as BackupRecord[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** كتابة القائمة — ترمي استثناءً عند فشل التخزين حتى لا تُحذف نسخة سليمة */
function write(list: BackupRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  snapshot = null;
  listeners.forEach((l) => l());
}
export function subscribeBackups(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let snapshot: BackupMeta[] | null = null;

function byNewest(a: { at: string }, b: { at: string }) {
  return +new Date(b.at) - +new Date(a.at);
}

export function listBackups(): BackupMeta[] {
  if (snapshot) return snapshot;
  snapshot = read()
    .map(({ data: _data, ...meta }) => meta)
    .sort(byNewest);
  return snapshot;
}

export function latestBackup(): BackupMeta | undefined {
  return listBackups()[0];
}

export type BackupResult =
  | { ok: true; meta: BackupMeta }
  | { ok: false; reason: "duplicate" | "failed" };

function dayOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * إنشاء نسخة احتياطية كاملة.
 * - النسخة الجديدة تُكتب أولًا، ولا تُحذف أي نسخة قديمة إلا بعد نجاح الكتابة.
 * - يُحتفظ بآخر 7 نسخ تلقائية فعلية (النسخ اليدوية لا تُحذف بهذا الحد).
 */
export function createBackup(kind: "auto" | "manual" = "manual"): BackupResult {
  if (typeof window === "undefined") return { ok: false, reason: "failed" };
  let data: string;
  try {
    data = JSON.stringify(getState());
  } catch {
    return { ok: false, reason: "failed" };
  }

  const existing = read().sort(byNewest);

  // منع النسخ المتطابقة المتكررة خلال دقيقة واحدة
  if (kind === "manual") {
    const last = existing[0];
    if (last && last.data === data && Date.now() - +new Date(last.at) < 60_000) {
      return { ok: false, reason: "duplicate" };
    }
  }

  const rec: BackupRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    size: new Blob([data]).size,
    kind,
    ok: true,
    data,
  };

  // 1) كتابة النسخة الجديدة دون حذف أي شيء
  try {
    write([rec, ...existing]);
  } catch {
    // فشل الحفظ: القائمة السابقة تبقى كما هي بالكامل
    return { ok: false, reason: "failed" };
  }

  // 2) بعد التأكد من النجاح فقط: تقليم النسخ التلقائية الزائدة
  try {
    const all = read().sort(byNewest);
    const autos = all.filter((b) => b.kind === "auto");
    if (autos.length > MAX_AUTO) {
      const drop = new Set(autos.slice(MAX_AUTO).map((b) => b.id));
      write(all.filter((b) => !drop.has(b.id)));
    }
  } catch {
    /* التقليم غير حرج */
  }

  const { data: _d, ...meta } = rec;
  return { ok: true, meta };
}

export function deleteBackup(id: string) {
  write(read().filter((b) => b.id !== id));
}

export function restoreBackup(id: string) {
  const rec = read().find((b) => b.id === id);
  if (!rec) return false;
  try {
    replaceState(JSON.parse(rec.data) as AppState);
    return true;
  } catch {
    return false;
  }
}

export function downloadBackup(id: string) {
  const rec = read().find((b) => b.id === id);
  if (!rec) return false;
  try {
    const blob = new Blob([rec.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(rec.at);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/** اسم ملف واضح وسهل البحث داخل الهاتف */
export function backupFileName(iso: string = new Date().toISOString()) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const time = `${p(d.getHours())}-${p(d.getMinutes())}`;
  return `دفتري_نسخة_احتياطية_${date}_${time}.json`;
}


export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب`;
}

/**
 * نسخة تلقائية واحدة فقط لكل يوم يُفتح فيه التطبيق.
 * الأيام التي لم يُفتح فيها التطبيق لا تُنشأ لها نسخ وهمية.
 */
export function maybeAutoBackup() {
  if (typeof window === "undefined") return;
  const today = dayOf(new Date().toISOString());
  const hasToday = read().some((b) => b.kind === "auto" && b.ok && dayOf(b.at) === today);
  if (hasToday) return;
  createBackup("auto");
}

/** فحص عند الفتح ثم كل 30 دقيقة (لتغطية تغيّر اليوم أثناء التشغيل) */
export function startBackupLoop() {
  if (typeof window === "undefined") return () => {};
  const t = setTimeout(() => maybeAutoBackup(), 1500);
  const i = setInterval(() => maybeAutoBackup(), 30 * 60 * 1000);
  return () => {
    clearTimeout(t);
    clearInterval(i);
  };
}
