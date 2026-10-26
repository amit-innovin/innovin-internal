// Review defaults to dry-run. The explicit --apply flag writes only DATABASE_CA_CERT;
// this script never deploys. API contract: https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
const path = process.argv.find(arg => arg.startsWith('--certificate='))?.slice('--certificate='.length);
if (!path) throw new Error('Pass --certificate=/absolute/path/to/trusted-ca.crt');
const certificate = readFileSync(path, 'utf8');
const parsed = new X509Certificate(certificate);
if (!parsed.ca || Date.parse(parsed.validTo) <= Date.now()) throw new Error('Certificate must be an unexpired CA');
const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (project.projectName !== 'innovin-internal') throw new Error('Expected the Innovin Internal project');
console.log(JSON.stringify({ project: project.projectName, target: 'production', key: 'DATABASE_CA_CERT', certificateFingerprint: parsed.fingerprint256, certificateExpires: parsed.validTo, apply: process.argv.includes('--apply') }));
if (process.argv.includes('--apply')) {
  const token = process.env.VERCEL_TOKEN || readFileSync('.env', 'utf8').match(/^VERCEL_TOKEN=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (!token) throw new Error('VERCEL_TOKEN is required');
  const response = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(project.projectId)}/env?upsert=true&teamId=${encodeURIComponent(project.orgId)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'DATABASE_CA_CERT', value: certificate, type: 'encrypted', target: ['production'] }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Vercel configuration write failed: HTTP ${response.status}`);
  const result = await response.json();
  if (result.failed?.length) throw new Error('Vercel rejected the environment update');
  console.log('Production CA saved. Existing deployments are unchanged; deploy through the required PR/release workflow.');
}
