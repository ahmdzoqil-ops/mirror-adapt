/**
 * حفظ ومشاركة الملفات.
 * - داخل تطبيق أندرويد (Capacitor): Filesystem + Share الأصليان.
 * - في الويب: التنزيل المعتاد وWeb Share.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** ختم زمني موحّد لأسماء الملفات: YYYY-MM-DD_HH-mm */
export function stamp(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(
    d.getMinutes(),
  )}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read-failed"));
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.readAsDataURL(blob);
  });
}

function webDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type SaveResult =
  | { ok: true; where: "downloads" | "documents" | "browser"; uri?: string }
  | { ok: false; error: string };

/** حفظ ملف في مكان يمكن للمستخدم الوصول إليه من مدير الملفات */
export async function saveFile(blob: Blob, name: string, text?: string): Promise<SaveResult> {
  if (!isNative()) {
    try {
      webDownload(blob, name);
      return { ok: true, where: "browser" };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  }

  const dirs: Array<{ dir: Directory; where: "downloads" | "documents" }> = [
    { dir: Directory.Documents, where: "documents" },
    { dir: Directory.External, where: "downloads" },
    { dir: Directory.Data, where: "documents" },
  ];

  let lastErr = "";
  for (const { dir, where } of dirs) {
    try {
      const res =
        text !== undefined
          ? await Filesystem.writeFile({
              path: `دفتري/${name}`,
              data: text,
              directory: dir,
              encoding: Encoding.UTF8,
              recursive: true,
            })
          : await Filesystem.writeFile({
              path: `دفتري/${name}`,
              data: await blobToBase64(blob),
              directory: dir,
              recursive: true,
            });
      return { ok: true, where, uri: res.uri };
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
    }
  }
  return { ok: false, error: lastErr || "write-failed" };
}

export type ShareResult = "shared" | "cancelled" | "saved" | "failed";

/** مشاركة ملف عبر لوحة المشاركة الأصلية في أندرويد، أو Web Share في المتصفح */
export async function shareFile(
  blob: Blob,
  name: string,
  title: string,
  text?: string,
): Promise<ShareResult> {
  if (isNative()) {
    const saved = await saveFile(blob, name, text);
    if (!saved.ok || !saved.uri) return "failed";
    try {
      await Share.share({ title, files: [saved.uri], dialogTitle: title });
      return "shared";
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/cancel|abort|dismiss/i.test(msg)) return "cancelled";
      return "saved";
    }
  }

  const type = blob.type || "application/octet-stream";
  const file = new File([blob], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }
  const res = await saveFile(blob, name, text);
  return res.ok ? "saved" : "failed";
}

/** مشاركة نص/رابط عبر لوحة المشاركة الأصلية */
export async function shareText(title: string, text: string, url?: string): Promise<ShareResult> {
  if (isNative()) {
    try {
      await Share.share({ title, text, ...(url ? { url } : {}), dialogTitle: title });
      return "shared";
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/cancel|abort|dismiss/i.test(msg)) return "cancelled";
      return "failed";
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, ...(url ? { url } : {}) });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }
  return "failed";
}

/** مكان الحفظ بصيغة مفهومة للمستخدم */
export function whereLabel(where: string) {
  if (where === "downloads") return "مجلد التنزيلات";
  if (where === "documents") return "مجلد المستندات › دفتري";
  return "ملفات الجهاز";
}