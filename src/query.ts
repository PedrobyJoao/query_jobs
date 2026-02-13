import type { Job } from "./schema";
import type { Filters } from "./filters";
import { buildHardPredicate } from "./filters";
import { parseQuery } from "./parser";
import { createJobStream, defaultDataPath } from "./data_source";
import { ensureSession, getSessionIds, setSessionIds } from "./session";
import type { JobSummary } from "./job_summary";
import { toJobSummary } from "./job_summary";

const DEFAULT_QUERY_LIMIT = 200;

export type QueryInput = {
  readonly query: string;
  readonly session_id?: string;
  readonly limit?: number;
};

export type QueryOptions = {
  readonly dataPath?: string;
};

export type QueryStreamOptions = {
  readonly limit?: number;
};

export type QueryStreamResult = {
  readonly ids: ReadonlyArray<string>; // TODO: remove it, it can be fetch from results
  readonly results: ReadonlyArray<JobSummary>;
  readonly count: number; // TODO: remove it, it can be fetch from results
  readonly scannedJobs: number;
};

export type QueryResponse = {
  readonly session_id: string;
  readonly count: number;
  readonly scannedJobs: number;
  readonly results: ReadonlyArray<JobSummary>;
};

export const query = async (
  input: QueryInput,
  options: QueryOptions = {},
): Promise<QueryResponse> => {
  const sessionId = ensureSession(input.session_id);
  const dataPath = options.dataPath ?? defaultDataPath();
  const source = createJobStream(dataPath);

  console.log("[query] session_id", sessionId);
  console.log("[query] resolving query with llms", input.query);
  const filters = await parseQuery(input.query);
  console.log("[query] user query parsed to filters", JSON.stringify(filters));

  const limit = resolveLimit(input.limit);

  const sessionIds = getSessionIds(sessionId);
  const sessionJobs =
    sessionIds.length === 0 ? source : filterByIds(source, new Set(sessionIds));

  console.log("[query] initiating pipeline handling", sessionId);
  const { ids, results, count, scannedJobs } = await queryStream(
    sessionJobs,
    filters,
    {
      limit,
    },
  );

  console.log("[query] done. updating session with returned IDs", sessionId);
  setSessionIds(sessionId, ids);

  return {
    session_id: sessionId,
    count,
    scannedJobs,
    results,
  };
};

export const queryStream = async (
  source: AsyncIterable<Job>,
  filters: Filters,
  options: QueryStreamOptions = {},
): Promise<QueryStreamResult> => {
  const limit = resolveLimit(options.limit);
  if (limit <= 0) {
    return { ids: [], results: [], count: 0, scannedJobs: 0 };
  }

  const predicate = buildHardPredicate(filters);
  const ids: string[] = [];
  const results: JobSummary[] = [];
  let scannedJobs = 0;

  for await (const job of source) {
    scannedJobs += 1;
    if (!predicate(job)) {
      continue;
    }
    ids.push(job.id);
    results.push(toJobSummary(job));
    if (ids.length >= limit) {
      break;
    }
  }

  return { ids, results, count: ids.length, scannedJobs };
};

export const filterByIds = async function* (
  source: AsyncIterable<Job>,
  keepIds: ReadonlySet<string>,
): AsyncGenerator<Job> {
  for await (const job of source) {
    if (keepIds.has(job.id)) {
      yield job;
    }
  }
};

const resolveLimit = (limit?: number): number => limit ?? DEFAULT_QUERY_LIMIT;
