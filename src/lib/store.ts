import { useSyncExternalStore } from "react";

/** نطاق العملية: يومية (ديون اليوم) أو دفتر (حسابات العملاء المستمرة) */
export type Scope = "daily" | "ledger";

export type Client = {
  id: string;
  name: string;
  phone?: string | undefined;
  photo?: string | undefined;
  /** عميل مسجّل في قسم المديونية (حساب مستمر) */
  ledger: boolean;
  manual: boolean;
  createdAt: string;
  /** كتم إشعارات هذا العميل */
  notifyMuted?: boolean | undefined;
  /** عدد الأيام الخاص بهذا العميل (null = استخدام الإعداد العام) */
  notifyDays?: number | null | undefined;
};

export type Txn = {
  id: string;
  clientId: string;
  amount: number;
  at: string; // ISO
  scope: Scope;
  note?: string | undefined;
  photos?: string[] | undefined;
};

export type Settings = {
  /** قفل عند فتح التطبيق (اختياري) */
  lockEnabled: boolean;
  /** طلب الرمز للعمليات الحساسة (مستقل تمامًا عن قفل الفتح) */
  sensitiveLock: boolean;
  /** رمز الحماية */
  pin: string | null;
  biometric: boolean;
  onboarded: boolean;
  userName: string;
  userPhone: string;
  shopName: string;
  logo: string;
  currency: string;
  /** عنوان المستخدم / موقع المتجر (اختياري) */
  address?: string;
  /** الإشعارات */
  notifyLedger: boolean;
  notifyDaily: boolean;
  notifyLedgerDays: number;
  notifyDailyDays: number;
};

/** تكرار التذكير المدعوم */
export const ALERT_INTERVALS = [
  { days: 1, label: "يوميًا" },
  { days: 3, label: "كل 3 أيام" },
  { days: 5, label: "كل 5 أيام" },
  { days: 7, label: "أسبوعيًا" },
] as const;

export function alertIntervalLabel(days: number) {
  return ALERT_INTERVALS.find((i) => i.days === days)?.label ?? `كل ${days} أيام`;
}

/** تنبيه واحد فقط لكل عميل */
export type AlertRule = {
  id: string;
  clientId: string;
  everyDays: number;
  createdAt: string;
  /** موعد التذكير القادم (ISO) */
  nextAt: string;
  lastNotifiedAt?: string | undefined;
};

/** عنصر في سلة المهملات — يحتفظ بالعملية الأصلية كما هي */
export type TrashItem = {
  kind: "debt" | "payment";
  txn: Txn;
  deletedAt: string;
};

export type AppState = {
  clients: Client[];
  debts: Txn[];
  payments: Txn[];
  trash: TrashItem[];
  alerts: AlertRule[];
  settings: Settings;
};

const KEY = "daftar-aldoyoun-v1";

export const defaultState: AppState = {
  clients: [],
  debts: [],
  payments: [],
  trash: [],
  alerts: [],
  settings: {
    lockEnabled: false,
    sensitiveLock: true,
    pin: null,
    biometric: false,
    onboarded: false,
    userName: "",
    userPhone: "",
    shopName: "",
    logo: "",
    currency: "ريال",
    address: "",
    notifyLedger: true,
    notifyDaily: true,
    notifyLedgerDays: 7,
    notifyDailyDays: 3,
  },
};

let state: AppState = defaultState;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

function migrateClient(c: Client): Client {
  return { ...c, ledger: c.ledger ?? c.manual ?? false, manual: c.manual ?? false };
}

function migrateTxn(t: Txn): Txn {
  return { ...t, scope: t.scope ?? "daily" };
}

export function loadState() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      state = {
        clients: (parsed.clients ?? []).map(migrateClient),
        debts: (parsed.debts ?? []).map(migrateTxn),
        payments: (parsed.payments ?? []).map(migrateTxn),
        trash: (parsed.trash ?? []).filter((t) => t && t.txn && t.kind),
        alerts: parsed.alerts ?? [],
        settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
      };
    }
  } catch {
    state = defaultState;
  }
  purgeOld();
  state = promoteToLedger(state);
  persist();
  emit();
}

function setState(updater: (s: AppState) => AppState) {
  state = pruneAlerts(promoteToLedger(updater(state)));
  persist();
  emit();
}

/**
 * ترقية تلقائية إلى قسم المديونية:
 * إذا وُجد لدى الشخص عمليتا دين غير مسددتين (بعد توزيع السداد على الديون
 * بالترتيب الزمني) يُنشأ له حساب في المديونية وتُربط به عملياته السابقة.
 * لا تراجع تلقائي: العميل يبقى في المديونية بعد ذلك حتى يُحذف يدويًا.
 */
function promoteToLedger(s: AppState): AppState {
  let changed = false;
  const clients = s.clients.map((c) => {
    if (c.ledger) return c;
    if (unsettledDebtsIn(s, c.id).length >= 2) {
      changed = true;
      return { ...c, ledger: true };
    }
    return c;
  });
  return changed ? { ...s, clients } : s;
}

/** الديون غير المسددة للعميل — يوزَّع مجموع السداد على الديون بالترتيب الزمني */
function unsettledDebtsIn(s: AppState, clientId: string): Txn[] {
  const debts = s.debts
    .filter((t) => t.clientId === clientId)
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  let pool = s.payments
    .filter((p) => p.clientId === clientId)
    .reduce((a, p) => a + p.amount, 0);
  const out: Txn[] = [];
  for (const d of debts) {
    if (pool >= d.amount) pool -= d.amount;
    else {
      pool = 0;
      out.push(d);
    }
  }
  return out;
}

export function unsettledDebts(s: AppState, clientId: string) {
  return unsettledDebtsIn(s, clientId);
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => defaultState);
}

export function replaceState(next: AppState) {
  setState(() => ({
    clients: (next.clients ?? []).map(migrateClient),
    debts: (next.debts ?? []).map(migrateTxn),
    payments: (next.payments ?? []).map(migrateTxn),
    trash: next.trash ?? [],
    alerts: next.alerts ?? [],
    settings: { ...defaultState.settings, ...(next.settings ?? {}) },
  }));
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** حذف التقارير الأقدم من سنة */
function purgeOld() {
  const limit = Date.now() - 366 * 24 * 60 * 60 * 1000;
  const keep = (t: Txn) => new Date(t.at).getTime() >= limit;
  const debts = state.debts.filter(keep);
  const payments = state.payments.filter(keep);
  if (debts.length !== state.debts.length || payments.length !== state.payments.length) {
    state = { ...state, debts, payments };
    persist();
  }
}

/* ============ عملاء ============ */

export function findOrCreateClient(name: string, ledger = false): Client {
  const trimmed = name.trim();
  const existing = state.clients.find(
    (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) {
    if (ledger && !existing.ledger) {
      updateClient(existing.id, { ledger: true });
      return { ...existing, ledger: true };
    }
    return existing;
  }
  const client: Client = {
    id: uid(),
    name: trimmed,
    ledger,
    manual: false,
    createdAt: new Date().toISOString(),
  };
  setState((s) => ({ ...s, clients: [...s.clients, client] }));
  return client;
}

export function addClient(data: { name: string; phone?: string; photo?: string }) {
  const client: Client = {
    id: uid(),
    name: data.name.trim(),
    phone: data.phone,
    photo: data.photo,
    ledger: true,
    manual: true,
    createdAt: new Date().toISOString(),
  };
  setState((s) => ({ ...s, clients: [client, ...s.clients] }));
  return client;
}

export function updateClient(id: string, patch: Partial<Client>) {
  setState((s) => ({
    ...s,
    clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }));
}

/** حذف العميل مع كل عملياته (قرار يدوي صريح فقط) */
export function deleteClient(id: string) {
  setState((s) => ({
    ...s,
    clients: s.clients.filter((c) => c.id !== id),
    debts: s.debts.filter((d) => d.clientId !== id),
    payments: s.payments.filter((p) => p.clientId !== id),
    trash: s.trash.filter((t) => t.txn.clientId !== id),
  }));
}

/** تصفير الحساب: حذف كل عمليات العميل مع إبقاء العميل */
export function resetClientAccount(id: string) {
  setState((s) => ({
    ...s,
    debts: s.debts.filter((d) => d.clientId !== id),
    payments: s.payments.filter((p) => p.clientId !== id),
  }));
}


/* ============ عمليات ============ */

type TxnInput = {
  clientName?: string;
  clientId?: string;
  amount: number;
  at?: string;
  scope: Scope;
  note?: string;
  photos?: string[];
};

function buildTxn(input: TxnInput): Txn | undefined {
  const ledger = input.scope === "ledger";
  let client = input.clientId ? state.clients.find((c) => c.id === input.clientId) : undefined;
  if (!client) client = findOrCreateClient(input.clientName ?? "", ledger);
  else if (ledger && !client.ledger) updateClient(client.id, { ledger: true });
  if (!client) return undefined;
  return {
    id: uid(),
    clientId: client.id,
    amount: input.amount,
    at: input.at ?? new Date().toISOString(),
    scope: input.scope,
    note: input.note,
    photos: input.photos ?? [],
  };
}

export function addDebt(input: TxnInput) {
  const txn = buildTxn(input);
  if (!txn) return;
  setState((s) => ({ ...s, debts: [txn, ...s.debts] }));
  return txn;
}

export function addPayment(input: TxnInput) {
  const txn = buildTxn(input);
  if (!txn) return;
  setState((s) => ({ ...s, payments: [txn, ...s.payments] }));
  return txn;
}

export function updateTxn(kind: "debt" | "payment", id: string, patch: Partial<Txn>) {
  setState((s) => {
    const key = kind === "debt" ? "debts" : "payments";
    return { ...s, [key]: s[key].map((t) => (t.id === id ? { ...t, ...patch } : t)) };
  });
}

/** الحذف ينقل العملية إلى سلة المهملات بدل الحذف النهائي */
export function deleteTxn(kind: "debt" | "payment", id: string) {
  setState((s) => {
    const key = kind === "debt" ? "debts" : "payments";
    const txn = s[key].find((t) => t.id === id);
    if (!txn) return s;
    return {
      ...s,
      [key]: s[key].filter((t) => t.id !== id),
      trash: [{ kind, txn, deletedAt: new Date().toISOString() }, ...s.trash],
    };
  });
}

/** استعادة العملية الأصلية نفسها (بدون نسخة جديدة) */
export function restoreTxn(id: string) {
  setState((s) => {
    const item = s.trash.find((t) => t.txn.id === id);
    if (!item) return s;
    const key = item.kind === "debt" ? "debts" : "payments";
    const exists = s[key].some((t) => t.id === id);
    const list = exists ? s[key] : [item.txn, ...s[key]];
    return { ...s, [key]: list, trash: s.trash.filter((t) => t.txn.id !== id) };
  });
}

/** حذف نهائي لا يمكن التراجع عنه */
export function purgeTxn(id: string) {
  setState((s) => ({ ...s, trash: s.trash.filter((t) => t.txn.id !== id) }));
}

export function clearTrash() {
  setState((s) => ({ ...s, trash: [] }));
}

/* ============ إعدادات ============ */

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/* ============ مشتقات ============ */

/**
 * عمليات حساب العميل داخل قسم المديونية.
 * المزامنة باتجاه واحد: اليومية → المديونية.
 * إذا كان العميل مسجّلًا في المديونية تُحتسب له كل العمليات (يومية + دفتر)،
 * أما عمليات المديونية فلا تظهر أبدًا في اليومية.
 */
export function accountTxns(s: AppState, clientId: string) {
  const client = s.clients.find((c) => c.id === clientId);
  const all = client?.ledger === true;
  const keep = (t: Txn) => t.clientId === clientId && (all || t.scope === "ledger");
  return { debts: s.debts.filter(keep), payments: s.payments.filter(keep) };
}

/** رصيد حساب العميل في قسم المديونية */
export function balanceOf(s: AppState, clientId: string) {
  const { debts, payments } = accountTxns(s, clientId);
  const d = debts.reduce((a, t) => a + t.amount, 0);
  const p = payments.reduce((a, t) => a + t.amount, 0);
  return d - p;
}


export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayKey() {
  return dayKey(new Date().toISOString());
}

/** العميل يظهر في المديونية إذا كان مسجّلًا في الدفتر — ولا يُحذف تلقائيًا أبدًا */
export function isDebtor(_s: AppState, client: Client) {
  return client.ledger;
}

export function clientById(s: AppState, id: string) {
  return s.clients.find((c) => c.id === id);
}

export function clientName(s: AppState, id: string) {
  return clientById(s, id)?.name ?? "—";
}

/* ============ تنبيهات ============ */

/** آخر عملية سداد للعميل (ISO) أو undefined */
export function lastPaymentAt(s: AppState, clientId: string) {
  const list = s.payments
    .filter((p) => p.clientId === clientId)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return list[0]?.at;
}

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** عدد الأيام المعتمد للعميل في المديونية */
export function ledgerDaysFor(s: AppState, c: Client) {
  return c.notifyDays ?? s.settings.notifyLedgerDays;
}

export type Reminder = {
  key: string;
  clientId: string;
  title: string;
  body: string;
};

/** حساب التنبيهات المستحقة اليوم */
export function dueReminders(s: AppState): Reminder[] {
  const out: Reminder[] = [];
  const today = todayKey();

  if (s.settings.notifyLedger) {
    for (const c of s.clients) {
      if (!c.ledger || c.notifyMuted) continue;
      const bal = balanceOf(s, c.id);
      if (bal <= 0) continue;
      const { debts } = accountTxns(s, c.id);
      const lastPay = lastPaymentAt(s, c.id);
      const lastDebt = debts.sort((a, b) => +new Date(b.at) - +new Date(a.at))[0]?.at;
      const ref = lastPay ?? lastDebt ?? c.createdAt;
      const days = daysSince(ref);
      if (days >= ledgerDaysFor(s, c)) {
        out.push({
          key: `ledger-${c.id}-${today}`,
          clientId: c.id,
          title: `متابعة مديونية: ${c.name}`,
          body: `مضى ${days} يومًا بدون سداد — الرصيد ${bal}`,
        });
      }
    }
  }

  if (s.settings.notifyDaily) {
    for (const d of s.debts) {
      if (d.scope !== "daily") continue;
      const c = s.clients.find((x) => x.id === d.clientId);
      if (!c || c.notifyMuted) continue;
      const paid = s.payments
        .filter((p) => p.clientId === d.clientId && +new Date(p.at) >= +new Date(d.at))
        .reduce((a, p) => a + p.amount, 0);
      if (paid >= d.amount) continue;
      const days = daysSince(d.at);
      if (days >= (c.notifyDays ?? s.settings.notifyDailyDays)) {
        out.push({
          key: `daily-${d.id}-${today}`,
          clientId: c.id,
          title: `دين لم يُسدَّد: ${c.name}`,
          body: `مضى ${days} يومًا على دين بقيمة ${d.amount}`,
        });
      }
    }
  }

  return out;
}

/* ============ نظام التنبيهات الذكي ============ */

/**
 * قاعدة أساسية: تنبيه نشط واحد فقط لكل عميل.
 * يُلغى التنبيه تلقائيًا عند سداد كامل المبلغ أو حذف العميل.
 */
function pruneAlerts(s: AppState): AppState {
  const alerts = s.alerts.filter((a) => {
    const c = s.clients.find((x) => x.id === a.clientId);
    if (!c) return false;
    return balanceOf(s, a.clientId) > 0;
  });
  // إزالة أي تكرار لنفس العميل (إبقاء الأحدث فقط)
  const seen = new Set<string>();
  const unique: AlertRule[] = [];
  for (const a of [...alerts].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt))) {
    if (seen.has(a.clientId)) continue;
    seen.add(a.clientId);
    unique.push(a);
  }
  if (unique.length === s.alerts.length) return s;
  return { ...s, alerts: unique };
}

export function alertFor(s: AppState, clientId: string) {
  return s.alerts.find((a) => a.clientId === clientId);
}

/** إنشاء/استبدال تنبيه العميل — يلغي القديم وجدولته */
export function setAlert(clientId: string, everyDays: number) {
  const now = new Date();
  const rule: AlertRule = {
    id: uid(),
    clientId,
    everyDays,
    createdAt: now.toISOString(),
    nextAt: new Date(now.getTime() + everyDays * 86400000).toISOString(),
  };
  setState((s) => ({ ...s, alerts: [...s.alerts.filter((a) => a.clientId !== clientId), rule] }));
  return rule;
}

export function removeAlert(clientId: string) {
  setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.clientId !== clientId) }));
}

/** إعادة جدولة نفس التنبيه بعد عرضه (بدون إنشاء تنبيه جديد) */
export function rollAlert(clientId: string) {
  const now = new Date();
  setState((s) => ({
    ...s,
    alerts: s.alerts.map((a) =>
      a.clientId === clientId
        ? {
            ...a,
            lastNotifiedAt: now.toISOString(),
            nextAt: new Date(now.getTime() + a.everyDays * 86400000).toISOString(),
          }
        : a,
    ),
  }));
}

export type ActiveAlert = {
  rule: AlertRule;
  client: Client;
  remaining: number;
  due: boolean;
};

/** التنبيهات النشطة (لكل عميل تنبيه واحد) مرتبة بالأقرب موعدًا */
export function activeAlerts(s: AppState): ActiveAlert[] {
  return s.alerts
    .map((rule) => {
      const client = s.clients.find((c) => c.id === rule.clientId);
      if (!client) return null;
      const remaining = balanceOf(s, rule.clientId);
      if (remaining <= 0) return null;
      return { rule, client, remaining, due: +new Date(rule.nextAt) <= Date.now() };
    })
    .filter((a): a is ActiveAlert => a !== null)
    .sort((a, b) => +new Date(a.rule.nextAt) - +new Date(b.rule.nextAt));
}

export function dueAlerts(s: AppState) {
  return activeAlerts(s).filter((a) => a.due);
}
