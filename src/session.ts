import crypto from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";

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

const defaultDataPath = (): string =>
  new URL("../data.jsonl", import.meta.url).pathname;

const loadJobs = async (dataPath: string): Promise<ReadonlyArray<Job>> => {
  const stream = fs.createReadStream(dataPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const jobs: Job[] = [];

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    jobs.push(JSON.parse(trimmed) as Job);
  }

  return jobs;
};

const ensureDataLoaded = async (dataPath: string): Promise<void> => {
  if (cachedJobs) {
    return;
  }
  const jobs = await loadJobs(dataPath);
  cachedJobs = jobs;
  cachedJobsById = new Map(jobs.map((job) => [job.id, job]));
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
  const results = query(baseData, filters);
  const nextIds = results.map((job) => job.id);

  sessions.set(sessionId, nextIds);

  return {
    session_id: sessionId,
    count: results.length,
    results,
  };
};
