import crypto from "node:crypto";

// TODO: remove global variable, simply pass it as arg everywhere
// if it's not a copy
const sessions = new Map<SessionId, ReadonlyArray<string>>();

export type SessionId = string;

export const ensureSession = (sessionId?: SessionId): SessionId => {
  if (sessionId && sessions.has(sessionId)) {
    return sessionId;
  }
  const nextId = sessionId ?? crypto.randomUUID();
  sessions.set(nextId, []);
  return nextId;
};

export const getSessionIds = (sessionId: SessionId): ReadonlyArray<string> =>
  sessions.get(sessionId) ?? [];

export const setSessionIds = (
  sessionId: SessionId,
  ids: ReadonlyArray<string>,
): void => {
  sessions.set(sessionId, ids);
};
