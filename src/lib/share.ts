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

/** أقصى طول آمن للرابط حتى لا يتعطل المتصفح */
const MAX_HASH = 8000;

export function shareUrlFor(s: AppState, clientId: string) {
  const payload = buildSharePayload(s, clientId);
  if (!payload) return null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  let encoded = encodeShare(payload);
  // تقليص العمليات تدريجيًا (الأحدث أولًا) إذا كان الرابط طويلًا
  let txns = payload.txns;
  while (encoded.length > MAX_HASH && txns.length > 5) {
    txns = txns.slice(-Math.max(5, Math.floor(txns.length / 2)));
    encoded = encodeShare({ ...payload, txns });
  }
  if (encoded.length > MAX_HASH) return null;
  return `${origin}/share#${encoded}`;
}
