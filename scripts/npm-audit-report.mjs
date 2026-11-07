#!/usr/bin/env node
/* Summarise npm audit JSON for CI. Raw advisory URLs are retained in the
 * uploaded artifact, but no environment variables or npm credentials are read.
 * Exit nonzero for high/critical production dependencies only.
 */
import { readFileSync, appendFileSync } from 'node:fs';

const [allFile = 'npm-audit-all.json', productionFile = 'npm-audit-production.json'] = process.argv.slice(2);
function load(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (data.error) throw new Error(data.error.summary || data.error.message || 'registry audit failed');
    if (!data.metadata?.vulnerabilities || !data.vulnerabilities) throw new Error('unexpected report schema');
    return data;
  } catch (err) {
    console.error(`Unable to read npm audit report ${path}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 2;
    return null;
  }
}
const all = load(allFile);
const production = load(productionFile);
if (!all || !production) process.exit(2);
function totals(a) {
  const v = a.metadata.vulnerabilities;
  return `Critical ${v.critical || 0} | High ${v.high || 0} | Moderate ${v.moderate || 0} | Low ${v.low || 0} | Total ${v.total || 0}`;
}
console.log('\n=== npm audit: all dependencies ===');
console.log(totals(all));
console.log('\n=== npm audit: production dependencies only ===');
console.log(totals(production));

const severityRank = { critical: 0, high: 1, moderate: 2, low: 3 };
const findings = Object.entries(production.vulnerabilities)
  .sort((a, b) => (severityRank[a[1].severity] ?? 9) - (severityRank[b[1].severity] ?? 9));
console.log('\n=== production package findings (first 60) ===');
for (const [name, problem] of findings.slice(0, 60)) {
  const entries = (problem.via || []).filter(a => typeof a === 'object');
  const refs = entries.map(a => a.url || a.title).filter(Boolean);
  const fix = problem.fixAvailable === false ? 'no automatic fix' :
    typeof problem.fixAvailable === 'object' ?
      `fix: ${problem.fixAvailable.name}@${problem.fixAvailable.version} (breaking=${!!problem.fixAvailable.isSemVerMajor})` :
      'compatible fix available';
  console.log(`[${problem.severity}] ${name}@${problem.range} via ${refs.slice(0, 3).join(' ; ')} | ${fix}`);
}
const output = process.env.GITHUB_STEP_SUMMARY;
if (output) appendFileSync(output, [
  '## Dependency vulnerability audit',
  `- All: ${totals(all)}`,
  `- Production: ${totals(production)}`,
  '- Full details: npm-audit-reports workflow artifact',
].join('\n') + '\n');

const prod = production.metadata.vulnerabilities;
if (Number(prod.critical || 0) > 0 || Number(prod.high || 0) > 0) {
  console.error('Production dependencies contain HIGH or CRITICAL advisories. Release blocked.');
  process.exitCode = 1;
}
