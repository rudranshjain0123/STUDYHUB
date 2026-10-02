import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PasscodeInput = z.object({ passcode: z.string().min(1).max(200) });

const ChangePasscodeInput = z.object({
  currentPasscode: z.string().min(1).max(200),
  newPasscode: z.string().min(6).max(120),
});

const BootstrapInput = z.object({
  displayName: z.string().min(2).max(60),
  passcode: z.string().min(6).max(120),
});

/** Whether the group has any members yet (drives first-run admin setup). */
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("member_credentials")
    .select("user_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { needsSetup: (count ?? 0) === 0 };
});

/** Exchange a passcode for a real session. */
export const loginWithPasscode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PasscodeInput.parse(input))
  .handler(async ({ data }) => {
    const { hashPasscode } = await import("@/lib/passcode.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const hash = hashPasscode(data.passcode);
    const { data: cred } = await supabaseAdmin
      .from("member_credentials")
      .select("email")
      .eq("passcode_hash", hash)
      .maybeSingle();

    if (!cred) return { ok: false as const, error: "That passcode isn't recognised." };

    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const authClient = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error } = await authClient.auth.signInWithPassword({
      email: cred.email,
      password: data.passcode.trim(),
    });

    if (error || !signIn.session) {
      return { ok: false as const, error: "That passcode isn't recognised." };
    }

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });

/** One-time first-run creation of the admin account. Refuses once any member exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BootstrapInput.parse(input))
  .handler(async ({ data }) => {
    const { hashPasscode, synthEmail } = await import("@/lib/passcode.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("member_credentials")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      return { ok: false as const, error: "Setup has already been completed." };
    }

    const email = synthEmail(data.displayName);
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.passcode.trim(),
      email_confirm: true,
    });
    if (createError || !created.user) {
      return { ok: false as const, error: createError?.message ?? "Could not create the admin." };
    }

    const userId = created.user.id;
    await supabaseAdmin.from("profiles").insert({ id: userId, display_name: data.displayName });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    await supabaseAdmin.from("member_credentials").insert({
      user_id: userId,
      email,
      passcode_hash: hashPasscode(data.passcode),
    });

    return { ok: true as const };
  });

/** Let a signed-in member rotate their own passcode after proving the current one. */
export const changeOwnPasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChangePasscodeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { hashPasscode } = await import("@/lib/passcode.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentHash = hashPasscode(data.currentPasscode);
    const { data: credential } = await supabaseAdmin
      .from("member_credentials")
      .select("email, passcode_hash")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!credential || credential.passcode_hash !== currentHash) {
      return { ok: false as const, error: "Current passcode is incorrect." };
    }

    const nextHash = hashPasscode(data.newPasscode);
    if (nextHash === currentHash) {
      return { ok: false as const, error: "Choose a new passcode first." };
    }

    const { data: clash } = await supabaseAdmin
      .from("member_credentials")
      .select("user_id")
      .eq("passcode_hash", nextHash)
      .maybeSingle();
    if (clash && clash.user_id !== context.userId) {
      return { ok: false as const, error: "That passcode is already in use." };
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPasscode.trim(),
    });
    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin
      .from("member_credentials")
      .update({ passcode_hash: nextHash })
      .eq("user_id", context.userId);

    return { ok: true as const };
  });
