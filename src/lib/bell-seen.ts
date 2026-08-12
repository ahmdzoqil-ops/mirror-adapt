/**
 * تتبّع التنبيهات التي شاهدها المستخدم في الجرس.
 * الهدف: عداد الجرس يصبح صفرًا فور فتح الجرس، ويعود عند وصول تنبيهات جديدة.
 * هذا لا يحذف التنبيهات ولا يمسّ إعدادات العملاء ولا الديون.
 */
const KEY = "daftari-bell-seen-v1";

const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = []);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    cache = Array.isArray(raw) ? (raw.filter((k) => typeof k === "string") as string[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function subscribeSeen(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function seenKeys(): string[] {
  return read();
}

export function seenServer(): string[] {
  return [];
}

/** تعليم مجموعة مفاتيح كمقروءة */
export function markSeen(keys: string[]) {
  const cur = new Set(read());
  let changed = false;
  for (const k of keys) if (!cur.has(k)) { cur.add(k); changed = true; }
  if (!changed) return;
  cache = [...cur];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* تجاهل */
  }
  listeners.forEach((l) => l());
}
