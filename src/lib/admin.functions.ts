import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { z } from "zod";

const CreateInput = z.object({
  displayName: z.string().min(2).max(60),
  passcode: z.string().min(6).max(120),
  avatarColor: z.string().min(2).max(32).optional(),
  classSection: z.string().max(40).optional(),
  rollNumber: z.string().max(40).optional(),
  isAdmin: z.boolean().default(false),
});

const UpdateInput = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(2).max(60).optional(),
  passcode: z.string().min(6).max(120).optional(),
  avatarColor: z.string().min(2).max(32).optional(),
  classSection: z.string().max(40).optional(),
  rollNumber: z.string().max(40).optional(),
  isAdmin: z.boolean().optional(),
});

const DeleteInput = z.object({ userId: z.string().uuid() });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: works }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_color, class_section, roll_number, created_at")
        .order("display_name"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("works").select("uploader_id"),
    ]);

    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const contributionCounts = new Map<string, number>();
    for (const work of works ?? []) {
      contributionCounts.set(work.uploader_id, (contributionCounts.get(work.uploader_id) ?? 0) + 1);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      avatarColor: p.avatar_color,
      classSection: p.class_section,
      rollNumber: p.roll_number,
      createdAt: p.created_at,
      isAdmin: adminIds.has(p.id),
      contributionCount: contributionCounts.get(p.id) ?? 0,
    }));
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { hashPasscode, synthEmail } = await import("@/lib/passcode.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hash = hashPasscode(data.passcode);
    const { data: clash } = await supabaseAdmin
      .from("member_credentials")
      .select("user_id")
      .eq("passcode_hash", hash)
      .maybeSingle();
    if (clash) return { ok: false as const, error: "That passcode is already in use." };

    const email = synthEmail(data.displayName);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.passcode.trim(),
      email_confirm: true,
    });
    if (error || !created.user) {
      return { ok: false as const, error: error?.message ?? "Could not create that member." };
    }

    const userId = created.user.id;
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      display_name: data.displayName,
      avatar_color: data.avatarColor ?? "teal",
      class_section: data.classSection?.trim() || null,
      roll_number: data.rollNumber?.trim() || null,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.isAdmin ? "admin" : "member" });
    await supabaseAdmin
      .from("member_credentials")
      .insert({ user_id: userId, email, passcode_hash: hash });

    return { ok: true as const };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { hashPasscode } = await import("@/lib/passcode.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const profileUpdate: Record<string, string | null> = {};
    if (data.displayName) profileUpdate.display_name = data.displayName;
    if (data.avatarColor) profileUpdate.avatar_color = data.avatarColor;
    if (data.classSection !== undefined)
      profileUpdate.class_section = data.classSection.trim() || null;
    if (data.rollNumber !== undefined) profileUpdate.roll_number = data.rollNumber.trim() || null;

    if (Object.keys(profileUpdate).length) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", data.userId);
    }

    if (data.passcode) {
      const hash = hashPasscode(data.passcode);
      const { data: clash } = await supabaseAdmin
        .from("member_credentials")
        .select("user_id")
        .eq("passcode_hash", hash)
        .maybeSingle();
      if (clash && clash.user_id !== data.userId) {
        return { ok: false as const, error: "That passcode is already in use." };
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.passcode.trim(),
      });
      if (error) return { ok: false as const, error: error.message };
      await supabaseAdmin
        .from("member_credentials")
        .update({ passcode_hash: hash })
        .eq("user_id", data.userId);
    }

    if (data.isAdmin !== undefined) {
      if (!data.isAdmin && data.userId === context.userId) {
        return { ok: false as const, error: "You can't remove your own admin access." };
      }
      if (data.isAdmin) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
        const { data: existingMemberRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", data.userId)
          .eq("role", "member")
          .maybeSingle();
        if (!existingMemberRole) {
          await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "member" });
        }
      }
    }

    return { ok: true as const };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-guard.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      return { ok: false as const, error: "You can't remove your own admin account." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
