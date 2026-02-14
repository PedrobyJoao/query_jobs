import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import type { Job } from "./schema";

export type DataFormat = "json" | "jsonl";

export const defaultDataPath = (): string =>
  new URL("../data.jsonl", import.meta.url).pathname;

export const createJobStream = (dataPath: string): AsyncIterable<Job> => {
  const format = formatFromPath(dataPath);
  return format === "json" ? readJson(dataPath) : readJsonL(dataPath);
};

const readJson = async function* (
  dataPath: string,
): AsyncGenerator<Job> {
  const raw = await fs.promises.readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of jobs");
  }
  for (const job of parsed) {
    yield job as Job;
  }
};

const readJsonL = async function* (
  dataPath: string,
): AsyncGenerator<Job> {
  const stream = fs.createReadStream(dataPath, { encoding: "utf8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  let isFirstLine = true;
  let buffer = "";

  const isRecoverableParseError = (error: unknown): boolean => {
    if (!(error instanceof SyntaxError)) {
      return false;
    }
    return (
      error.message.includes("Unexpected end of JSON input") ||
      error.message.includes("Unterminated string")
    );
  };

  const isBadControlCharError = (error: unknown): boolean => {
    if (!(error instanceof SyntaxError)) {
      return false;
    }
    return error.message.includes("Bad control character");
  };

  const escapeControlChar = (char: string): string => {
    switch (char) {
      case "\b":
        return "\\b";
      case "\f":
        return "\\f";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\t":
        return "\\t";
      default: {
        const code = char.charCodeAt(0);
        const hex = code.toString(16).padStart(2, "0").toUpperCase();
        return `\\u00${hex}`;
      }
    }
  };

  const sanitizeControlCharsInStrings = (payload: string): string => {
    let inString = false;
    let escape = false;
    let sanitized = "";

    for (let index = 0; index < payload.length; index += 1) {
      const char = payload[index];
      if (!inString) {
        if (char === '"') {
          inString = true;
        }
        sanitized += char;
        continue;
      }

      if (escape) {
        escape = false;
        sanitized += char;
        continue;
      }
      if (char === "\\") {
        escape = true;
        sanitized += char;
        continue;
      }
      if (char === '"') {
        inString = false;
        sanitized += char;
        continue;
      }

      const code = char.charCodeAt(0);
      if (code < 0x20) {
        sanitized += escapeControlChar(char);
        continue;
      }
      sanitized += char;
    }

    return sanitized;
  };

  const tryParse = (payload: string): Job | undefined => {
    try {
      return JSON.parse(payload) as Job;
    } catch (error) {
      if (isRecoverableParseError(error)) {
        return undefined;
      }
      if (isBadControlCharError(error)) {
        const sanitized = sanitizeControlCharsInStrings(payload);
        try {
          return JSON.parse(sanitized) as Job;
        } catch (sanitizedError) {
          if (isRecoverableParseError(sanitizedError)) {
            return undefined;
          }
          throw sanitizedError;
        }
      }
      throw error;
    }
  };

  try {
    for await (const line of reader) {
      let text = line;
      if (isFirstLine) {
        isFirstLine = false;
        if (text.startsWith("\uFEFF")) {
          text = text.slice(1);
        }
      }

      if (buffer.length === 0) {
        const trimmed = text.trim();
        if (trimmed.length === 0) {
          continue;
        }
        if (trimmed.startsWith("[")) {
          throw new Error("JSON array detected; use a .json file");
        }
        buffer = text;
      } else {
        buffer = `${buffer}\n${text}`;
      }

      const parsed = tryParse(buffer);
      if (!parsed) {
        continue;
      }
      buffer = "";
      yield parsed;
    }
    if (buffer.trim().length > 0) {
      const parsed = tryParse(buffer);
      if (!parsed) {
        throw new Error("Incomplete JSON object in JSONL file");
      }
      yield parsed;
    }
  } finally {
    reader.close();
    stream.destroy();
  }
};

const formatFromPath = (dataPath: string): DataFormat => {
  const extension = path.extname(dataPath).toLowerCase();
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".jsonl" || extension === ".ndjson") {
    return "jsonl";
  }
  throw new Error("Unsupported data file extension");
};
