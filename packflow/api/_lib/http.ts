import { SnowflakeAuthError, SnowflakeConfigError, SnowflakeQueryError } from "./snowflake";

export type ApiQuery = Record<string, string | string[] | undefined>;

export type ApiRequest = {
  method?: string;
  url?: string;
  query?: ApiQuery;
  body?: unknown;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function json(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export function methodNotAllowed(res: ApiResponse, allow: string) {
  res.setHeader("Allow", allow);
  json(res, 405, { error: "Method not allowed" });
}

export function createHandler(method: "GET" | "POST", run: (req: ApiRequest) => Promise<unknown>) {
  return async function handler(req: ApiRequest, res: ApiResponse) {
    if ((req.method ?? "").toUpperCase() !== method) {
      methodNotAllowed(res, method);
      return;
    }
    try {
      json(res, 200, await run(req));
    } catch (error) {
      handleError(res, error);
    }
  };
}

export function handleError(res: ApiResponse, error: unknown) {
  if (error instanceof HttpError) {
    json(res, error.status, { error: error.message });
    return;
  }
  if (error instanceof SnowflakeConfigError) {
    json(res, 500, { error: error.message });
    return;
  }
  if (error instanceof SnowflakeAuthError) {
    json(res, 401, { error: error.message });
    return;
  }
  if (error instanceof SnowflakeQueryError) {
    const status = error.status >= 400 && error.status < 500 ? 400 : 502;
    json(res, status, { error: error.message });
    return;
  }
  json(res, 500, { error: "Unexpected server error" });
}

export function readObject(req: ApiRequest): Record<string, unknown> {
  const body = req.body;
  if (body == null || body === "") {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  const value = typeof body === "string" ? parseJson(body) : body;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export function textField(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function queryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
}
