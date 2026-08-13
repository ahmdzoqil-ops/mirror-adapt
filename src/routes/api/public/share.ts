import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const txnSchema = z.object({
  k: z.enum(["d", "p"]),
  a: z.number(),
  at: z.string().max(40),
  n: z.string().max(500).optional(),
});

const payloadSchema = z.object({
  v: z.literal(1),
  shop: z.string().max(120),
  owner: z.string().max(120),
  ownerPhone: z.string().max(40),
  currency: z.string().max(20),
  client: z.object({ name: z.string().max(120), phone: z.string().max(40) }),
  balance: z.number(),
  txns: z.array(txnSchema).max(500),
  issuedAt: z.string().max(40),
});

const bodySchema = z.object({
  action: z.enum(["create", "revoke"]),
  token: z.string().max(64).optional(),
  editKey: z.string().max(64).optional(),
  payload: payloadSchema.optional(),
});

function newToken(len: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const Route = createFileRoute("/api/public/share")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!/^[A-Z0-9]{4,32}$/.test(token)) return json({ error: "bad_token" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("shares")
          .select("payload,revoked")
          .eq("token", token)
          .maybeSingle();
        if (error) return json({ error: "server_error" }, 500);
        if (!data || data.revoked) return json({ error: "not_found" }, 404);
        return json({ payload: data.payload });
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad_json" }, 400);
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return json({ error: "bad_body" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.data.action === "revoke") {
          const { token, editKey } = parsed.data;
          if (!token || !editKey) return json({ error: "bad_body" }, 400);
          const { error } = await supabaseAdmin
            .from("shares")
            .update({ revoked: true, updated_at: new Date().toISOString() })
            .eq("token", token)
            .eq("edit_key", editKey);
          if (error) return json({ error: "server_error" }, 500);
          return json({ ok: true });
        }

        const payload = parsed.data.payload;
        if (!payload) return json({ error: "bad_body" }, 400);

        // تحديث رابط قائم عند إرسال المفتاح الصحيح، وإلا إنشاء رابط جديد
        if (parsed.data.token && parsed.data.editKey) {
          const { data, error } = await supabaseAdmin
            .from("shares")
            .update({ payload, revoked: false, updated_at: new Date().toISOString() })
            .eq("token", parsed.data.token)
            .eq("edit_key", parsed.data.editKey)
            .select("token")
            .maybeSingle();
          if (error) return json({ error: "server_error" }, 500);
          if (data) return json({ token: parsed.data.token, editKey: parsed.data.editKey });
        }

        const token = newToken(8);
        const editKey = newToken(24);
        const { error } = await supabaseAdmin
          .from("shares")
          .insert({ token, edit_key: editKey, payload });
        if (error) return json({ error: "server_error" }, 500);
        return json({ token, editKey });
      },
    },
  },
});