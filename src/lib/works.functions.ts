import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PathInput = z.object({ path: z.string().min(1).max(500), download: z.boolean().optional() });

/** Short-lived signed URL for viewing or downloading a stored PDF. */
export const getWorkFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PathInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("work-files")
      .createSignedUrl(data.path, 60 * 60, data.download ? { download: true } : undefined);
    if (error || !signed) throw new Error(error?.message ?? "Could not open that file.");
    return { url: signed.signedUrl };
  });
