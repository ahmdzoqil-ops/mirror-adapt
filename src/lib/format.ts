/** رمز الريال السعودي كنص SVG — للتقارير و PDF */
export function riyalSvg(color = "currentColor", size = 13) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="vertical-align:-1px" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 2.5v9.2c0 2.6-1.9 4.6-4.4 4.6"/><path d="M11 4.6v6.9"/><path d="M21 13.4 3.2 16.6"/><path d="M21 18.2 3.2 21.4"/></svg>`;
}

/** رمز الريال كنص عادي (إشعارات النظام) */
export const RIYAL_TEXT = "\uFDFC";

export function formatMoney(n: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n || 0);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** ISO -> قيمة حقل datetime-local محلية */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}
