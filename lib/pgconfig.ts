import type { PoolConfig } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SSL_PARAMS = ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"];

// Builds the pg Pool config from DATABASE_URL.
// node-postgres lets `sslmode` in the URL override an explicit `ssl` option, so SSL params are
// stripped from the URL and SSL is configured here instead:
//   - local hosts                  → no SSL
//   - DATABASE_CA_CERT set           → verified TLS against that CA (recommended)
//   - DATABASE_SSL_VERIFY=true       → verified TLS against the system trust store
//   - otherwise                      → verified TLS against the system trust store
// Remote sslmode=disable and DATABASE_SSL_VERIFY=false cannot bypass verification.
type DbEnv = Record<string, string | undefined>;

export function pgConfig(url = process.env.DATABASE_URL ?? "", env: DbEnv = process.env): PoolConfig {
  const parsed = new URL(url);
  for (const p of SSL_PARAMS) parsed.searchParams.delete(p);

  let ssl: PoolConfig["ssl"];
  if (LOCAL_HOSTS.has(parsed.hostname)) ssl = false;
  else if (env.DATABASE_CA_CERT) ssl = { ca: env.DATABASE_CA_CERT.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  else ssl = { rejectUnauthorized: true };

  return {
    connectionString: parsed.toString(),
    ssl,
    max: Number(env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Keep pooled connections alive across serverless invocations — without this, an idle
    // TCP connection drops silently and the next query pays a full reconnect + TLS handshake.
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
  };
}
