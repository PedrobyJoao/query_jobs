import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

import { query, type QueryInput, type QueryResponse } from "./query";

const defaultPort = "3000";

export type ServerOptions = {
  readonly port?: number;
  readonly dataPath?: string;
};

export const startServer = (options: ServerOptions = {}) => {
  const port = options.port ?? getPort();
  const dataPath = options.dataPath;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/query") {
      await handleQuery(req, res, dataPath);
      return;
    }

    writeJson(res, 404, { error: "Not Found" });
  });

  server.listen(port);
  return server;
};

const handleQuery = async (
  req: IncomingMessage,
  res: ServerResponse,
  dataPath?: string,
): Promise<void> => {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = await readJson<QueryInput>(req);
    if (!payload.query || payload.query.trim().length === 0) {
      writeJson(res, 400, { error: "query is required" });
      return;
    }

    // todo: QueryInput should not have dataPath from API call
    const input: QueryInput =
      dataPath && !payload.dataPath ? { ...payload, dataPath } : payload;

    const result: QueryResponse = await query(input);
    writeJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    writeJson(res, 500, { error: message });
  }
};

const readJson = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length === 0) {
    return {} as T;
  }
  return JSON.parse(text) as T;
};

const writeJson = (
  res: ServerResponse,
  status: number,
  payload: unknown,
): void => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
};

// getPort gets either from env or a default num
const getPort = (): number => {
  const raw = process.env.PORT ?? defaultPort;
  const port = Number.parseInt(raw, 10);
  return Number.isNaN(port) ? 3000 : port;
};
