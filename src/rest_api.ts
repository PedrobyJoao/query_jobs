import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

import {
  ensureDataLoaded,
  defaultDataPath,
  search,
  type SearchInput,
  type SearchResponse,
} from "./session";

export type ServerOptions = {
  readonly port?: number;
  readonly dataPath?: string;
};

const defaultPort = (): number => {
  const raw = process.env.PORT ?? "3000";
  const port = Number.parseInt(raw, 10);
  return Number.isNaN(port) ? 3000 : port;
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

const handleSearch = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = await readJson<SearchInput>(req);
    if (!payload.query || payload.query.trim().length === 0) {
      writeJson(res, 400, { error: "query is required" });
      return;
    }

    const result: SearchResponse = await search(payload);
    writeJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    writeJson(res, 500, { error: message });
  }
};

export const startServer = async (options: ServerOptions = {}) => {
  const port = options.port ?? defaultPort();
  const dataPath = options.dataPath ?? defaultDataPath();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/search") {
      await handleSearch(req, res);
      return;
    }

    writeJson(res, 404, { error: "Not Found" });
  });

  server.listen(port);
  await ensureDataLoaded(dataPath);
  return server;
};
