import type { Job } from "./schema";
import type { Filters } from "./filters";
import { buildHardPredicate } from "./filters";
import { parseQuery } from "./parser";
import { createJobStream, defaultDataPath } from "./data_source";
import { ensureSession, getSessionIds, setSessionIds } from "./session";

const defaultLimit = 200;

export type QueryInput = {
  readonly query: string;
  readonly session_id?: string;
  readonly dataPath?: string;
  readonly limit?: number;
};

export type QueryStreamOptions = {
  readonly limit?: number;
};

export type QueryStreamResult = {
  readonly ids: ReadonlyArray<string>;
  readonly count: number;
};

export type QueryResponse = {
  readonly session_id: string;
  readonly count: number;
  readonly ids: ReadonlyArray<string>;
};

export const query = async (input: QueryInput): Promise<QueryResponse> => {
  const sessionId = ensureSession(input.session_id);
  const dataPath = input.dataPath ?? defaultDataPath();
  const source = createJobStream(dataPath);
  const filters = await parseQuery(input.query);
  const limit = input.limit ?? defaultLimit;

  console.log("[query] session_id", sessionId);
  console.log("[query] filters", JSON.stringify(filters));

  const sessionIds = getSessionIds(sessionId);
  const sessionJobs =
    sessionIds.length === 0 ? source : filterByIds(source, new Set(sessionIds));

  console.log("[query] initiating pipeline handling", sessionId);
  const { ids, count } = await queryStream(sessionJobs, filters, {
    limit,
  });

  console.log("[query] done. updating session with returned IDs", sessionId);
  setSessionIds(sessionId, ids);

  return {
    session_id: sessionId,
    count,
    ids,
  };
};

export const queryStream = async (
  source: AsyncIterable<Job>,
  filters: Filters,
  options: QueryStreamOptions = {},
): Promise<QueryStreamResult> => {
  const limit = options.limit ?? defaultLimit;
  if (limit <= 0) {
    return { ids: [], count: 0 };
  }

  const predicate = buildHardPredicate(filters);
  const ids: string[] = [];

  for await (const job of source) {
    if (!predicate(job)) {
      continue;
    }
    ids.push(job.id);
    if (ids.length >= limit) {
      break;
    }
  }

  return { ids, count: ids.length };
};

const filterByIds = async function* (
  source: AsyncIterable<Job>,
  keepJobsByIDs: ReadonlySet<string>,
): AsyncGenerator<Job> {
  for await (const job of source) {
    if (keepJobsByIDs.has(job.id)) {
      yield job;
    }
  }
};
