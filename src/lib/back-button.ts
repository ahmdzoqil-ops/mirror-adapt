import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

/**
 * نظام رجوع موحّد:
 * - الشاشات الداخلية (صفحات فرعية داخل نفس المسار) تسجّل معالجًا مؤقتًا.
 * - زر الرجوع داخل التطبيق وزر Android يستخدمان نفس المسار المنطقي.
 */
type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

export function pushBackHandler(h: BackHandler): () => void {
  handlers.push(h);
  return () => {
    const i = handlers.indexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** يسجّل معالج رجوع للشاشة الفرعية طالما كانت مفتوحة */
export function useBackHandler(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => {
      fn();
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fn]);
}

function closeTopOverlay(): boolean {
  const overlay = document.querySelector<HTMLElement>(
    "[data-state='open'][role='dialog'], [data-state='open'][role='alertdialog']",
  );
  if (!overlay) return false;
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  return true;
}

function runHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]!()) return true;
  }
  return false;
}

/** الرجوع خطوة واحدة: نافذة مفتوحة ← شاشة فرعية ← تاريخ التنقل */
export function appBack(): boolean {
  if (closeTopOverlay()) return true;
  if (runHandlers()) return true;
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
    return true;
  }
  return false;
}

/** يُسجَّل مرة واحدة فقط في جذر التطبيق */
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
    void App.addListener("backButton", ({ canGoBack }) => {
      if (closeTopOverlay()) return;
      if (runHandlers()) return;
      if (canGoBack || window.location.pathname !== "/" || window.history.length > 1) {
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
