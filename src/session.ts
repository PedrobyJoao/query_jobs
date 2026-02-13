import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Job } from "./schema";
import { parseQuery } from "./parser";
import { query } from "./filters";

export type SearchInput = {
  readonly query: string;
  readonly session_id?: string;
  readonly dataPath?: string;
};

export type SearchResponse = {
  readonly session_id: string;
  readonly count: number;
  readonly results: ReadonlyArray<Job>;
};

const sessions = new Map<string, ReadonlyArray<string>>();
let cachedJobs: ReadonlyArray<Job> | null = null;
let cachedJobsById: Map<string, Job> | null = null;

export const defaultDataPath = (): string =>
  new URL("../data.jsonl", import.meta.url).pathname;

export const ensureDataLoaded = async (dataPath: string): Promise<void> => {
  if (cachedJobs) {
    return;
  }
  console.log("[ensureDataLoaded] loading jobs from", dataPath);
  const jobs = await loadJobs(dataPath);
  console.log("[ensureDataLoaded] loaded", jobs.length, "jobs");
  cachedJobs = jobs;
  cachedJobsById = new Map(jobs.map((job) => [job.id, job]));
};

const loadJobs = async (dataPath: string): Promise<ReadonlyArray<Job>> => {
  const format = dataFormatFromPath(dataPath);
  return format === "json" ? readJson(dataPath) : readJsonL(dataPath);
};

const dataFormatFromPath = (dataPath: string): "json" | "jsonl" => {
  const extension = path.extname(dataPath).toLowerCase();
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".jsonl" || extension === ".ndjson") {
    return "jsonl";
  }
  throw new Error("Unsupported data file extension");
};

const readJson = async (dataPath: string): Promise<ReadonlyArray<Job>> => {
  const raw = await fs.promises.readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of jobs");
  }
  return parsed as Job[];
};

const ensureSession = (sessionId?: string): string => {
  if (sessionId && sessions.has(sessionId)) {
    return sessionId;
  }
  const nextId = sessionId ?? crypto.randomUUID();
  sessions.set(nextId, []);
  return nextId;
};

const selectJobsForSession = (sessionId: string): ReadonlyArray<Job> => {
  const ids = sessions.get(sessionId) ?? [];
  if (!cachedJobs || !cachedJobsById || ids.length === 0) {
    return cachedJobs ?? [];
  }
  return ids
    .map((id) => cachedJobsById?.get(id))
    .filter((job): job is Job => Boolean(job));
};

export const search = async (input: SearchInput): Promise<SearchResponse> => {
  const dataPath = input.dataPath ?? defaultDataPath();
  const sessionId = ensureSession(input.session_id);

  await ensureDataLoaded(dataPath);

  const baseData = selectJobsForSession(sessionId);
  const filters = await parseQuery(input.query);
  console.log("[search] filters", JSON.stringify(filters));
  const results = query(baseData, filters);
  const nextIds = results.map((job) => job.id);

  sessions.set(sessionId, nextIds);

  return {
    session_id: sessionId,
    count: results.length,
    results,
  };
};

// TODO: we should use a library instead of writing this whole logic
const readJsonL = async (dataPath: string): Promise<ReadonlyArray<Job>> => {
  const stream = fs.createReadStream(dataPath, { encoding: "utf8" });
  const jobs: Job[] = [];

  let started = false;
  let depth = 0;
  let inString = false;
  let escape = false;
  let buffer = "";

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    jobs.push(JSON.parse(buffer) as Job);
    buffer = "";
  };

  for await (const chunk of stream) {
    const text = chunk.toString();
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (!started) {
        if (char === "\uFEFF") {
          continue;
        }
        if (char === "{") {
          started = true;
          depth = 1;
          buffer = "{";
          continue;
        }
        if (/\s/.test(char)) {
          continue;
        }
        if (char === "[") {
          throw new Error("JSON array detected; use a .json file");
        }
        continue;
      }

      buffer += char;

      if (inString) {
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\") {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          flush();
          started = false;
        }
      }
    }
  }

  if (started || buffer.length > 0) {
    throw new Error("Incomplete JSON object in JSONL file");
  }

  return jobs;
};
