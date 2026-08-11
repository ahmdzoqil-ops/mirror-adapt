/**
 * مصادقة بالبصمة.
 * - داخل تطبيق أندرويد (Capacitor): واجهة BiometricAuth الأصلية.
 * - في الويب/PWA: WebAuthn كما كان.
 */
import { Capacitor } from "@capacitor/core";

const CRED_KEY = "daftar-biometric-cred";
const NATIVE_KEY = "daftari-biometric-native";

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function nativeApi() {
  const mod = await import("@aparajita/capacitor-biometric-auth");
  return mod.BiometricAuth;
}

/** توفر المصادقة البيومترية فعليًا على الجهاز (بصمة/وجه/…) */
export async function biometricAvailable(): Promise<boolean> {
  if (isNative()) {
    try {
      const api = await nativeApi();
      const info = await api.checkBiometry();
      return info.isAvailable || info.strongBiometryIsAvailable;
    } catch {
      return false;
    }
  }
  if (!biometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function biometricSupported() {
  if (isNative()) return true;
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasBiometricCredential() {
  if (typeof window === "undefined") return false;
  if (isNative()) return localStorage.getItem(NATIVE_KEY) === "1";
  return !!localStorage.getItem(CRED_KEY);
}

export async function registerBiometric(userName: string): Promise<boolean> {
  if (isNative()) {
    if (!(await biometricAvailable())) return false;
    try {
      const api = await nativeApi();
      await api.authenticate({
        reason: "تأكيد هويتك لتفعيل البصمة",
        cancelTitle: "إلغاء",
        androidTitle: "دفتري",
        androidSubtitle: "تفعيل فتح التطبيق بالبصمة",
        allowDeviceCredential: true,
      });
      localStorage.setItem(NATIVE_KEY, "1");
      return true;
    } catch {
      return false;
    }
  }
  if (!biometricSupported()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "دفتري" },
        user: { id: userId, name: userName || "user", displayName: userName || "المستخدم" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, b64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function verifyBiometric(): Promise<boolean> {
  if (isNative()) {
    if (localStorage.getItem(NATIVE_KEY) !== "1") return false;
    try {
      const api = await nativeApi();
      await api.authenticate({
        reason: "تأكيد هويتك لفتح دفتري",
        cancelTitle: "إلغاء",
        androidTitle: "دفتري",
        androidSubtitle: "افتح باستخدام البصمة",
        allowDeviceCredential: true,
      });
      return true;
    } catch {
      return false;
    }
  }
  if (!biometricSupported()) return false;
  const stored = localStorage.getItem(CRED_KEY);
  if (!stored) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: fromB64(stored) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

export function clearBiometric() {
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(NATIVE_KEY);
}
