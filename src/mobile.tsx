/**
 * نقطة الدخول لنسخة أندرويد (Capacitor) — تعمل بدون خادم (SPA).
 * لا تغيّر أي منطق أو تصميم: تستخدم نفس الموجّه ونفس الصفحات.
 */
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

createRoot(document).render(<RouterProvider router={router} />);
