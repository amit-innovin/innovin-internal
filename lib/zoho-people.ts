import crypto from "node:crypto";
import { hit } from "./rate-limit";
import { todayIST } from "./time";

const TYPES = ["cl", "sl", "el", "fl"] as const;
type BalanceType = typeof TYPES[number];
export type ZohoLeaveData = {
  fetchedAt: string;
  balances: { type: BalanceType; remaining: number | null; booked: number | null }[];
  approved: { id: string; from: string; to: string; type: string; days: number }[];
};
export type ZohoLeaveResult = {
  state: "not-connected" | "unmapped" | "ready" | "stale" | "unavailable";
  message: string;
  data?: ZohoLeaveData;
};

type Config = { domain: string; client: string; secret: string; refresh: string; employee: string; types: Record<BalanceType, string>; dateFormat: string; fingerprint: string };
const cache = new Map<string, { data?: ZohoLeaveData; checked: number; pending?: Promise<ZohoLeaveResult>; result?: ZohoLeaveResult }>();
let tokenCache: { fingerprint: string; value: string; expires: number } | undefined;
let tokenPending: { fingerprint: string; promise: Promise<string> } | undefined;
let tokenFailure: { fingerprint: string; retryAt: number } | undefined;
const TTL = 5 * 60_000;
const MAX_STALE = 24 * 60 * 60_000;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identifier = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : "";

// Node 22 preserves the original numeric token through the JSON reviver context.
// Zoho IDs exceed Number.MAX_SAFE_INTEGER; rounding them can cross employee identities.
export function parseZohoJSON(raw: string): unknown {
  const parse = JSON.parse as (text: string, revive: (key: string, value: unknown, context?: { source?: string }) => unknown) => unknown;
  return parse(raw, (_key, value, context) => {
    if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      if (!context?.source || !/^\d+$/.test(context.source)) throw new Error("Unsupported Zoho numeric value");
      return context.source;
    }
    return value;
  });
}

function configuration(email: string): Config | null {
  const client = process.env.ZOHO_CLIENT_ID, secret = process.env.ZOHO_CLIENT_SECRET, refresh = process.env.ZOHO_REFRESH_TOKEN;
  if (!client || !secret || !refresh) return null;
  const domain = process.env.ZOHO_DATA_CENTER || "com";
  if (!["com", "in", "eu", "com.au", "com.cn"].includes(domain)) throw new Error("Invalid Zoho data center");
  const employees = object(JSON.parse(process.env.ZOHO_EMPLOYEE_IDS || "{}"));
  const employeeIds = Object.values(employees).map(identifier);
  if (employeeIds.some(id => !id) || new Set(employeeIds).size !== employeeIds.length || Object.keys(employees).some(key => key !== key.trim().toLowerCase())) throw new Error("Invalid Zoho employee mapping");
  const employee = identifier(employees[email.toLowerCase()]);
  const mapping = object(JSON.parse(process.env.ZOHO_LEAVE_TYPE_IDS || "{}"));
  const types = Object.fromEntries(TYPES.map(type => [type, identifier(mapping[type])])) as Record<BalanceType, string>;
  if (!employee || TYPES.some(type => !types[type]) || new Set(Object.values(types)).size !== TYPES.length) throw new Error("Missing Zoho identity mapping");
  const dateFormat = process.env.ZOHO_DATE_FORMAT || "dd-MMM-yyyy";
  if (!["dd-MMM-yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "MM/dd/yyyy"].includes(dateFormat)) throw new Error("Invalid Zoho date format");
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify([domain, client, secret, refresh, process.env.ZOHO_EMPLOYEE_IDS, types, dateFormat, process.env.ZOHO_PEOPLE_PORTAL_ID])).digest("hex");
  return { domain, client, secret, refresh, employee, types, dateFormat, fingerprint };
}

async function jsonResponse(response: Response) {
  if (!response.ok) throw new Error("Zoho request unavailable");
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Zoho response too large");
  const body = object(parseZohoJSON(text));
  if (body.error || body.errors || object(body.response).errors || body.status === "error") throw new Error("Zoho response rejected");
  return body;
}

async function accessToken(config: Config): Promise<string> {
  if (tokenCache?.fingerprint === config.fingerprint && tokenCache.expires > Date.now()) return tokenCache.value;
  if (tokenPending?.fingerprint === config.fingerprint) return tokenPending.promise;
  if (tokenFailure?.fingerprint === config.fingerprint && tokenFailure.retryAt > Date.now()) throw new Error("Zoho authorization retry delayed");
  const promise = (async () => {
    if (!hit(`zoho-token:${config.fingerprint}`, 10, 60_000).ok) throw new Error("Zoho token request budget reached");
    const body = await jsonResponse(await fetch(`https://accounts.zoho.${config.domain}/oauth/v2/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.client, client_secret: config.secret, refresh_token: config.refresh }),
      signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error",
    }));
    if (typeof body.access_token !== "string" || !body.access_token) throw new Error("Zoho connection needs authorization");
    const expires = Number(body.expires_in);
    if (!Number.isFinite(expires) || expires <= 30) throw new Error("Invalid Zoho token expiry");
    tokenCache = { fingerprint: config.fingerprint, value: body.access_token, expires: Date.now() + (Math.min(expires, 3600) - 30) * 1000 };
    tokenFailure = undefined;
    return body.access_token;
  })();
  tokenPending = { fingerprint: config.fingerprint, promise };
  try { return await promise; }
  catch (error) { tokenFailure = { fingerprint: config.fingerprint, retryAt: Date.now() + 60_000 }; throw error; }
  finally { if (tokenPending?.promise === promise) tokenPending = undefined; }
}

async function read(config: Config, path: string, params: Record<string, string>, token: string) {
  if (!hit(`zoho-read:${config.fingerprint}`, 25, 60_000).ok) throw new Error("Zoho request budget reached");
  const url = new URL(path, `https://people.zoho.${config.domain}`);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` }, signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error" });
  if (response.status === 401 && tokenCache?.fingerprint === config.fingerprint) tokenCache = undefined;
  return jsonResponse(response);
}

const numeric = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(number) || Math.abs(number) > 3660) throw new Error("Invalid Zoho leave amount");
  return number;
};
function date(value: unknown, format: string) {
  if (typeof value !== "string") throw new Error("Invalid Zoho date");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  const digits = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(value);
  const normalized = parts ? `${parts[3]}-${String(months.indexOf(parts[2]) + 1).padStart(2, "0")}-${parts[1]}`
    : digits && format === "dd-MM-yyyy" ? `${digits[3]}-${digits[2]}-${digits[1]}`
    : digits && format === "MM/dd/yyyy" ? `${digits[3]}-${digits[1]}-${digits[2]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || !Number.isFinite(Date.parse(normalized)) || new Date(normalized).toISOString().slice(0, 10) !== normalized) throw new Error("Invalid Zoho date");
  return normalized;
}

async function load(config: Config, year: number): Promise<ZohoLeaveData> {
  const token = await accessToken(config);
  const formatDate = (iso: string) => {
    const [year, month, day] = iso.split("-");
    if (config.dateFormat === "dd-MMM-yyyy") return `${day}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]}-${year}`;
    if (config.dateFormat === "dd-MM-yyyy") return `${day}-${month}-${year}`;
    if (config.dateFormat === "MM/dd/yyyy") return `${month}/${day}/${year}`;
    return iso;
  };
  const params = { from: formatDate(`${year}-01-01`), to: formatDate(`${year}-12-31`), dateFormat: config.dateFormat, employee: JSON.stringify([config.employee]) };
  const report = await read(config, "/people/api/v2/leavetracker/reports/bookedAndBalance", { ...params, to: year === Number(todayIST().slice(0, 4)) ? formatDate(todayIST()) : params.to, unit: "Day", leavetype: JSON.stringify(Object.values(config.types)), startIndex: "0", limit: "1" }, token);
  const employeeReport = object(object(report.report)[config.employee]);
  if (!Object.keys(employeeReport).length) throw new Error("Zoho employee report missing");
  const balances = TYPES.map(type => {
    const meta = object(object(report.leavetypes)[config.types[type]]);
    if (meta.unit !== undefined && !/^days?$/i.test(String(meta.unit))) throw new Error("Zoho balance is not in days");
    const row = object(employeeReport[config.types[type]]);
    return { type, remaining: numeric(row.balance), booked: numeric(row.booked) };
  });
  if (balances.every(row => row.remaining === null)) throw new Error("Zoho balances missing");
  const approved: ZohoLeaveData["approved"] = [];
  const ids = new Set<string>();
  for (let page = 0; page < 5; page++) {
    // Zoho documents this v2 records path without /people; the balance path above includes it.
    const body = await read(config, "/api/v2/leavetracker/leaves/records", { ...params, approvalStatus: JSON.stringify(["APPROVED"]), dataSelect: "ALL", startIndex: String(page * 200), limit: "200", ...(process.env.ZOHO_PEOPLE_PORTAL_ID ? { portalID: process.env.ZOHO_PEOPLE_PORTAL_ID } : {}) }, token);
    if (!body.records || typeof body.records !== "object" || Array.isArray(body.records)) throw new Error("Zoho leave records missing");
    const rows = Object.entries(object(body.records));
    for (const [id, value] of rows) {
      const row = object(value);
      if (identifier(row["Employee.ID"]) !== config.employee) throw new Error("Zoho employee mismatch");
      if (String(row.ApprovalStatus).toLowerCase() !== "approved") continue;
      if (!/^days?$/i.test(String(row.Unit))) throw new Error("Zoho leave units require mapping");
      if (ids.has(id)) throw new Error("Zoho pagination repeated records");
      ids.add(id);
      const amounts = Object.values(object(row.Days)).map(day => numeric(object(day).LeaveCount));
      if (!amounts.length || amounts.some(amount => amount === null || amount < 0 || amount > 1)) throw new Error("Zoho leave days missing");
      const from = date(row.From, config.dateFormat), to = date(row.To, config.dateFormat);
      if (from > to) throw new Error("Invalid Zoho leave range");
      approved.push({ id, from, to, type: typeof row.Leavetype === "string" ? row.Leavetype : "Leave", days: amounts.reduce<number>((total, amount) => total + amount!, 0) });
    }
    if (rows.length < 200) return { fetchedAt: new Date().toISOString(), balances, approved: approved.sort((a, b) => a.from.localeCompare(b.from)) };
  }
  throw new Error("Zoho leave pagination incomplete");
}

export async function zohoLeave(email: string, year: number): Promise<ZohoLeaveResult> {
  let config: Config | null;
  try { config = configuration(email); }
  catch { return { state: "unmapped", message: "Zoho setup is incomplete. Ask an admin to check your employee and leave-type mapping." }; }
  if (!config) return { state: "not-connected", message: "Zoho People is not connected. Manual snapshots remain available." };
  const key = `${config.fingerprint}:${config.employee}:${year}`;
  const entry = cache.get(key) ?? { checked: 0 };
  if (entry.result && Date.now() - entry.checked < TTL) return entry.result;
  if (entry.pending) return entry.pending;
  const configured = config;
  entry.pending = (async (): Promise<ZohoLeaveResult> => {
    try {
      const data = await load(configured, year);
      entry.data = data;
      return { state: "ready", message: "Read from Zoho People. Local requests are not deducted from these figures.", data };
    } catch {
      const data = entry.data && Date.now() - Date.parse(entry.data.fetchedAt) < MAX_STALE ? entry.data : undefined;
      return data ? { state: "stale", message: "Zoho could not be refreshed. Showing the last successful read; check Zoho before making leave decisions.", data }
        : { state: "unavailable", message: "Zoho could not be read. Showing the existing manual or policy view below." };
    }
  })();
  cache.set(key, entry);
  if (cache.size > 200) for (const [other, value] of cache) { if (!value.pending && other !== key) { cache.delete(other); break; } }
  try { entry.result = await entry.pending; entry.checked = Date.now(); return entry.result; }
  finally { entry.pending = undefined; }
}
