import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  subtype: z.string().nullable().optional(),
  workType: z.string(),
  uploader: z.string(),
});

const SearchInput = z.object({
  query: z.string().min(1).max(200),
  items: z.array(CandidateSchema).max(150),
});

export type SemanticMatch = { ids: string[] };

/**
 * Semantic search: the model reads the actual library entries and returns the
 * ids that are *related* to the query, not just literal string matches.
 * e.g. "photosynthesis" -> Science notebook work about plants/leaves.
 */
export const semanticSearchWorks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }): Promise<SemanticMatch> => {
    if (!data.items.length) return { ids: [] };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ids: [] };

    try {
      const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
      const { generateText, Output, NoObjectGeneratedError } = await import("ai");

      const gateway = createLovableAiGatewayProvider(key);

      const catalogue = data.items
        .map(
          (item) =>
            `${item.id} | ${item.title} | ${item.subject}${item.subtype ? ` (${item.subtype})` : ""} | ${item.workType} | uploaded by ${item.uploader}`,
        )
        .join("\n");

      try {
        const { output } = await generateText({
          model: gateway("google/gemini-3.5-flash"),
          output: Output.object({ schema: z.object({ ids: z.array(z.string()) }) }),
          system: [
            "You are the search engine for a school assignment library.",
            "You get a student's search phrase and a catalogue of entries, one per line, formatted as: id | title | subject (subtype) | work type | uploader.",
            "Subjects: English, Hindi, Maths, Science, SST, French, Reasoning, GK. 'lit' = Literature, 'lang' = Language.",
            "Return the ids of every entry that is RELATED to the phrase — by topic, meaning, subject, chapter, person or work type — not only exact word matches.",
            "Examples: 'plants' should match a Science entry about photosynthesis; 'notes from Ehaan' should match notebook work uploaded by Ehaan; 'algebra' should match Maths equations chapters.",
            "Order the ids from most to least relevant. Return at most 30 ids. If nothing is related, return an empty list.",
            "Only return ids copied exactly from the catalogue.",
          ].join(" "),
          prompt: `Search phrase: ${data.query}\n\nCatalogue:\n${catalogue}`,
        });

        const valid = new Set(data.items.map((item) => item.id));
        return { ids: (output?.ids ?? []).filter((id) => valid.has(id)).slice(0, 30) };
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) return { ids: [] };
        throw error;
      }
    } catch (error) {
      console.error("semantic search failed", error);
      return { ids: [] };
    }
  });
