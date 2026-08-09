/** مصادقة بالبصمة عبر WebAuthn (تعمل محليًا على أجهزة أندرويد الحديثة) */

const CRED_KEY = "daftar-biometric-cred";

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(str: string) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function biometricSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasBiometricCredential() {
  return typeof window !== "undefined" && !!localStorage.getItem(CRED_KEY);
}

export async function registerBiometric(userName: string): Promise<boolean> {
  if (!biometricSupported()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "دفتر الديون" },
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
}
