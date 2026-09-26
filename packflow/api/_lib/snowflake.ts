import { createHash, createPrivateKey, createPublicKey, randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

const REQUIRED_ENV = [
  "SNOWFLAKE_ACCOUNT",
  "SNOWFLAKE_USER",
  "SNOWFLAKE_PRIVATE_KEY",
  "SNOWFLAKE_WAREHOUSE",
  "SNOWFLAKE_DATABASE",
  "SNOWFLAKE_SCHEMA",
  "SNOWFLAKE_ROLE",
] as const;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export type SqlValue = string | number | boolean | null;

export type SqlRow = Record<string, string | null>;

type Binding = {
  type: "TEXT" | "REAL" | "BOOLEAN";
  value: string | null;
};

type StatementPayload = {
  code?: string;
  message?: string;
  statementHandle?: string;
  statementStatusUrl?: string;
  data?: (string | null)[][];
  resultSetMetaData?: {
    partitionInfo?: unknown[];
    rowType?: { name: string }[];
  };
};

export class SnowflakeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnowflakeConfigError";
  }
}

export class SnowflakeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnowflakeAuthError";
  }
}

export class SnowflakeQueryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SnowflakeQueryError";
    this.status = status;
  }
}

let cachedToken: { token: string; exp: number; key: string } | null = null;

export function qualifiedTable(name: "PACKAGES" | "DELIVERY_STOPS" | "DELIVERY_EVENTS"): string {
  const database = identifier(envValue("SNOWFLAKE_DATABASE"), "SNOWFLAKE_DATABASE");
  const schema = identifier(envValue("SNOWFLAKE_SCHEMA"), "SNOWFLAKE_SCHEMA");
  return `${database}.${schema}.${name}`;
}

export async function execute(statement: string, bindings: readonly SqlValue[] = []): Promise<SqlRow[]> {
  assertConfigured();
  const token = await getToken();
  const host = accountHost();
  const url = `https://${host}.snowflakecomputing.com/api/v2/statements?requestId=${randomUUID()}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(requestBody(statement, bindings)),
      signal: AbortSignal.timeout(70_000),
    });
  } catch (error) {
    throw new SnowflakeQueryError(networkMessage(error), 502);
  }

  const payload = await readPayload(response);
  if (response.status === 202) return poll(host, token, payload);
  if (!response.ok) throw statementError(response.status, payload);
  return collectRows(host, token, payload);
}

function assertConfigured() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new SnowflakeConfigError(`Missing Snowflake environment variables: ${missing.join(", ")}`);
  }
}

function envValue(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SnowflakeConfigError(`Missing Snowflake environment variable: ${name}`);
  return value;
}

function identifier(value: string, name: string): string {
  if (!IDENTIFIER.test(value)) {
    throw new SnowflakeConfigError(`${name} must be a Snowflake identifier`);
  }
  return value.toUpperCase();
}

function accountHost(): string {
  let host = envValue("SNOWFLAKE_ACCOUNT").toLowerCase();
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  host = host.replace(/\.snowflakecomputing\.com$/, "");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(host)) {
    throw new SnowflakeConfigError("SNOWFLAKE_ACCOUNT is not a valid account identifier");
  }
  return host;
}

function accountForJwt(account: string): string {
  return account.toUpperCase().replace(/\./g, "-");
}

function userForJwt(user: string): string {
  const name = user.toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(name)) {
    throw new SnowflakeConfigError("SNOWFLAKE_USER is not a valid user name");
  }
  return name;
}

function normalizePem(raw: string): string {
  let pem = raw.trim();
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1);
  }
  pem = pem.replace(/\\n/g, "\n").trim();
  if (!pem.includes("BEGIN")) {
    const decoded = Buffer.from(pem, "base64").toString("utf8").trim();
    if (decoded.includes("BEGIN")) pem = decoded;
  }
  return pem;
}

function loadPrivateKeyPem(): string {
  const passphrase = process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE?.trim();
  try {
    const key = createPrivateKey({
      key: normalizePem(envValue("SNOWFLAKE_PRIVATE_KEY")),
      format: "pem",
      passphrase: passphrase || undefined,
    });
    return key.export({ format: "pem", type: "pkcs8" }).toString();
  } catch {
    throw new SnowflakeAuthError(
      "Snowflake private key could not be read. Check SNOWFLAKE_PRIVATE_KEY and SNOWFLAKE_PRIVATE_KEY_PASSPHRASE.",
    );
  }
}

function publicKeyFingerprint(privatePem: string): string {
  const der = createPublicKey(privatePem).export({ format: "der", type: "spki" });
  return createHash("sha256").update(der).digest("base64");
}

async function getToken(): Promise<string> {
  const pem = loadPrivateKeyPem();
  const account = accountForJwt(accountHost());
  const user = userForJwt(envValue("SNOWFLAKE_USER"));
  const fingerprint = publicKeyFingerprint(pem);
  const cacheKey = `${account}.${user}.${fingerprint}`;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.exp - 60 > now) {
    return cachedToken.token;
  }

  try {
    const key = await importPKCS8(pem, "RS256");
    const exp = now + 59 * 60;
    const qualified = `${account}.${user}`;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(`${qualified}.SHA256:${fingerprint}`)
      .setSubject(qualified)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);
    cachedToken = { token, exp, key: cacheKey };
    return token;
  } catch (error) {
    if (error instanceof SnowflakeAuthError || error instanceof SnowflakeConfigError) throw error;
    throw new SnowflakeAuthError("Snowflake key-pair token could not be created");
  }
}

function authHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("User-Agent", "packflow");
  headers.set("X-Snowflake-Authorization-Token-Type", "KEYPAIR_JWT");
  return headers;
}

function requestBody(statement: string, bindings: readonly SqlValue[]) {
  const body: Record<string, unknown> = {
    statement,
    timeout: 60,
    database: identifier(envValue("SNOWFLAKE_DATABASE"), "SNOWFLAKE_DATABASE"),
    schema: identifier(envValue("SNOWFLAKE_SCHEMA"), "SNOWFLAKE_SCHEMA"),
    warehouse: identifier(envValue("SNOWFLAKE_WAREHOUSE"), "SNOWFLAKE_WAREHOUSE"),
    role: identifier(envValue("SNOWFLAKE_ROLE"), "SNOWFLAKE_ROLE"),
  };
  if (bindings.length > 0) {
    const mapped: Record<string, Binding> = {};
    bindings.forEach((value, index) => {
      mapped[String(index + 1)] = toBinding(value);
    });
    body.bindings = mapped;
  }
  return body;
}

function toBinding(value: SqlValue): Binding {
  if (value === null) return { type: "TEXT", value: null };
  if (typeof value === "boolean") return { type: "BOOLEAN", value: value ? "true" : "false" };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SnowflakeQueryError("Invalid numeric binding", 400);
    return { type: "REAL", value: String(value) };
  }
  return { type: "TEXT", value };
}

async function readPayload(response: Response): Promise<StatementPayload> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as StatementPayload;
  } catch {
    throw new SnowflakeQueryError("Snowflake returned an unreadable response", 502);
  }
}

function statementError(status: number, payload: StatementPayload): Error {
  const detail = scrub(payload.message ?? "Snowflake request failed");
  if (status === 401 || status === 403) return new SnowflakeAuthError(detail);
  return new SnowflakeQueryError(detail, status);
}

async function poll(host: string, token: string, payload: StatementPayload): Promise<SqlRow[]> {
  const statusUrl = statementUrl(host, payload);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await delay(300 * (attempt + 1));
    const response = await fetch(statusUrl, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(30_000),
    });
    const next = await readPayload(response);
    if (response.status === 202) continue;
    if (!response.ok) throw statementError(response.status, next);
    return collectRows(host, token, next);
  }
  throw new SnowflakeQueryError("Snowflake query timed out", 504);
}

async function collectRows(host: string, token: string, payload: StatementPayload): Promise<SqlRow[]> {
  const columns = payload.resultSetMetaData?.rowType ?? [];
  const chunks = [payload.data ?? []];
  const partitions = payload.resultSetMetaData?.partitionInfo?.length ?? 0;
  if (payload.statementHandle && partitions > 1) {
    for (let index = 1; index < partitions; index += 1) {
      const url = `https://${host}.snowflakecomputing.com/api/v2/statements/${payload.statementHandle}?partition=${index}`;
      const response = await fetch(url, {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(30_000),
      });
      const next = await readPayload(response);
      if (!response.ok) throw statementError(response.status, next);
      chunks.push(next.data ?? []);
    }
  }
  if (columns.length === 0) return [];
  return chunks.flat().map((row) => toRow(columns, row));
}

function statementUrl(host: string, payload: StatementPayload): string {
  if (payload.statementStatusUrl) {
    return new URL(payload.statementStatusUrl, `https://${host}.snowflakecomputing.com`).toString();
  }
  if (payload.statementHandle) {
    return `https://${host}.snowflakecomputing.com/api/v2/statements/${payload.statementHandle}`;
  }
  throw new SnowflakeQueryError("Snowflake query did not finish", 504);
}

function toRow(columns: { name: string }[], row: (string | null)[]): SqlRow {
  const mapped: SqlRow = {};
  columns.forEach((column, index) => {
    mapped[column.name.toUpperCase()] = row[index] ?? null;
  });
  return mapped;
}

function networkMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Snowflake request failed";
  return scrub(message);
}

function scrub(message: string): string {
  if (/bearer\s+\S+/i.test(message) || /private key/i.test(message) || message.includes("-----BEGIN")) {
    return "Snowflake request failed";
  }
  return message.replace(/\s+/g, " ").trim().slice(0, 400);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
