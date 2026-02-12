import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { Filters } from "./filters";

export type ParseQueryOptions = {
  readonly apiKey?: string;
  readonly model?: string;
  readonly client?: OpenAI;
  readonly signal?: AbortSignal;
};

const defaultModel = (): string => process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const resolveApiKey = (options: ParseQueryOptions): string => {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
};

const buildClient = (options: ParseQueryOptions): OpenAI =>
  options.client ?? new OpenAI({ apiKey: resolveApiKey(options) });

const systemPrompt =
  "You parse job search queries into structured filters. " +
  "Return JSON strictly matching the schema. " +
  "Use hard filters only for supported structured fields: " +
  "job_title_any, skills_any, workplace_type, commitment_any, seniority_any, location_any, company_non_profit. " +
  "Use soft filters for mission/values or free-text hints: company_mission_any, description_any. " +
  "Do not invent synonyms; use values as provided by the query. " +
  "If nothing matches, return empty arrays.";

export const parseQuery = async (
  query: string,
  options: ParseQueryOptions = {},
): Promise<Filters> => {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { hard: [], soft: [] };
  }

  const client = buildClient(options);
  const response = await client.responses.parse({
    model: options.model ?? defaultModel(),
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: trimmed },
    ],
    text: { format: zodTextFormat(filterSchema, "filter") },
    temperature: 0,
    signal: options.signal,
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("Empty model response");
  }
  return parsed;
};

const locationTokenSchema = z
  .object({
    city: z.string().optional(),
    state: z.string().optional(),
    countryCode: z.string().optional(),
    continent: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Location token must include at least one field",
  });

const hardFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("job_title_any"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("skills_any"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("workplace_type"),
    value: z.enum(["Remote", "Hybrid", "Onsite"]),
  }),
  z.object({
    kind: z.literal("commitment_any"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("seniority_any"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("location_any"),
    values: z.array(locationTokenSchema).min(1),
  }),
  z.object({
    kind: z.literal("company_non_profit"),
    value: z.boolean(),
  }),
]);

const softFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("company_mission_any"),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("description_any"),
    values: z.array(z.string()).min(1),
  }),
]);

const filterSchema: z.ZodType<Filters> = z.object({
  hard: z.array(hardFilterSchema),
  soft: z.array(softFilterSchema),
});
