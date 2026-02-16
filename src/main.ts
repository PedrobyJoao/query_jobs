import { startServer } from "./rest_api";

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  throw new Error(
    "Missing OPENAI_API_KEY. Export it as an environment variable.",
  );
}

startServer();
