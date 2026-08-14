import { accountTxns, balanceOf, type AppState } from "@/lib/store";

export type SharePayload = {
  v: 1;
  shop: string;
  owner: string;
  ownerPhone: string;
  currency: string;
  client: { name: string; phone: string };
  balance: number;
  txns: { k: "d" | "p"; a: number; at: string; n?: string | undefined }[];
  issuedAt: string;
};

function toBase64Url(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildSharePayload(s: AppState, clientId: string): SharePayload | null {
  const client = s.clients.find((c) => c.id === clientId);
  if (!client) return null;
  const { debts, payments } = accountTxns(s, clientId);
  const txns = [
    ...debts.map((t) => ({ k: "d" as const, a: t.amount, at: t.at, n: t.note })),
    ...payments.map((t) => ({ k: "p" as const, a: t.amount, at: t.at, n: t.note })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return {
    v: 1,
    shop: s.settings.shopName || s.settings.userName || "دفتري",
    owner: s.settings.userName,
    ownerPhone: s.settings.userPhone,
    currency: s.settings.currency,
    client: { name: client.name, phone: client.phone ?? "" },
    balance: balanceOf(s, clientId),
    txns: txns.map((t) => (t.n ? t : { k: t.k, a: t.a, at: t.at })),
    issuedAt: new Date().toISOString(),
  };
}

export function encodeShare(p: SharePayload) {
  return toBase64Url(JSON.stringify(p));
}

export function decodeShare(hash: string): SharePayload | null {
  try {
    const raw = hash.replace(/^#/, "");
    if (!raw || raw.length > 20000 || !/^[A-Za-z0-9\-_]+$/.test(raw)) return null;
    const parsed = JSON.parse(fromBase64Url(raw)) as SharePayload;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.txns)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * قاعدة الرابط العام.
 * داخل تطبيق أندرويد يكون origin هو localhost الداخلي، لذلك نستخدم دائمًا
 * نطاق التطبيق العام حتى يعمل الرابط من أي جهاز أو متصفح.
 */
export const PUBLIC_BASE = "https://project--62e29d3a-3cac-458b-93c5-058e4179fa90.lovable.app";

export function publicBase() {
  if (typeof window === "undefined") return PUBLIC_BASE;
  const o = window.location.origin;
  if (/^https:\/\//.test(o) && !/localhost/.test(o)) return o;
  return PUBLIC_BASE;
}

const LINKS_KEY = "daftari-share-links-v1";
const PENDING_KEY = "daftari-share-pending-v1";

type LinkRec = { token: string; editKey: string };

function readLinks(): Record<string, LinkRec> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) || "{}") as Record<string, LinkRec>;
  } catch {
    return {};
  }
}

function writeLinks(v: Record<string, LinkRec>) {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(v));
  } catch {
    /* تجاهل */
  }
}

function readPending(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function writePending(v: string[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(Array.from(new Set(v))));
  } catch {
    /* تجاهل */
  }
}

/** معرّف مشاركة آمن يُولَّد محليًا بدون إنترنت */
function randomId(len: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** يعيد معرّف المشاركة المحلي للعميل، وينشئه فورًا إن لم يوجد */
export function ensureShareId(clientId: string): LinkRec {
  const links = readLinks();
  const cur = links[clientId];
  if (cur) return cur;
  const rec: LinkRec = { token: randomId(8), editKey: randomId(24) };
  links[clientId] = rec;
  writeLinks(links);
  return rec;
}

export function shareUrlFor(clientId: string): string {
  return `${publicBase()}/share/${ensureShareId(clientId).token}`;
}

export function existingShareLink(clientId: string): string | null {
  const rec = readLinks()[clientId];
  return rec ? `${publicBase()}/share/${rec.token}` : null;
}

async function pushShare(rec: LinkRec, payload: SharePayload): Promise<boolean> {
  try {
    const res = await fetch(`${publicBase()}/api/public/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", payload, token: rec.token, editKey: rec.editKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ShareLinkResult =
  | { ok: true; url: string; synced: boolean }
  | { ok: false; reason: "no-client" };

/**
 * إنشاء رابط المتابعة: محلي وفوري ولا يعتمد على الإنترنت.
 * المزامنة مع الخادم تحدث بعد ذلك، وتُعاد المحاولة عند عودة الاتصال.
 */
export async function createShareLink(
  s: AppState,
  clientId: string,
): Promise<ShareLinkResult> {
  const payload = buildSharePayload(s, clientId);
  if (!payload) return { ok: false, reason: "no-client" };
  const rec = ensureShareId(clientId);
  const url = `${publicBase()}/share/${rec.token}`;
  const synced = await pushShare(rec, payload);
  if (!synced) writePending([...readPending(), clientId]);
  else writePending(readPending().filter((c) => c !== clientId));
  return { ok: true, url, synced };
}

/** مزامنة المشاركات المعلّقة عند توفر الإنترنت */
export async function syncPendingShares(getAppState: () => AppState) {
  const pending = readPending();
  if (!pending.length) return;
  const links = readLinks();
  const still: string[] = [];
  for (const clientId of pending) {
    const rec = links[clientId];
    const payload = rec ? buildSharePayload(getAppState(), clientId) : null;
    if (!rec || !payload) continue;
    const ok = await pushShare(rec, payload);
    if (!ok) still.push(clientId);
  }
  writePending(still);
}

/** يبدأ مراقبة الاتصال لمزامنة الروابط المعلّقة */
export function startShareSync(getAppState: () => AppState) {
  if (typeof window === "undefined") return () => {};
  const run = () => void syncPendingShares(getAppState);
  run();
  window.addEventListener("online", run);
  return () => window.removeEventListener("online", run);
}

/** تعطيل رابط المشاركة الحالي للعميل */
export async function revokeShareLink(clientId: string): Promise<boolean> {
  const rec = readLinks()[clientId];
  if (!rec) return true;
  try {
    const res = await fetch(`${publicBase()}/api/public/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", token: rec.token, editKey: rec.editKey }),
    });
    if (!res.ok) return false;
    const links = readLinks();
    delete links[clientId];
    writeLinks(links);
    writePending(readPending().filter((c) => c !== clientId));
    return true;
  } catch {
    return false;
  }
}
