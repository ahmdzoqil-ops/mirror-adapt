import { Capacitor } from "@capacitor/core";

/**
 * زر الرجوع في أندرويد: يرجع خطوة واحدة في التنقل،
 * ولا يغلق التطبيق إلا من الصفحة الرئيسية بلا تاريخ للرجوع.
 */
export function startBackButtonHandler() {
  let disposed = false;
  let remove: (() => void) | null = null;

  try {
    if (!Capacitor.isNativePlatform()) return () => {};
  } catch {
    return () => {};
  }

  void import("@capacitor/app").then(({ App }) => {
    if (disposed) return;
    void App.addListener("backButton", () => {
      // إغلاق أي نافذة/قائمة مفتوحة أولًا
      const overlay = document.querySelector<HTMLElement>(
        "[data-state='open'][role='dialog'], [data-state='open'][role='alertdialog']",
      );
      if (overlay) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
        return;
      }
      if (window.location.pathname !== "/" || window.history.length > 1) {
        window.history.back();
        return;
      }
      void App.exitApp();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else remove = () => void handle.remove();
    });
  });

  return () => {
    disposed = true;
    remove?.();
  };
}
