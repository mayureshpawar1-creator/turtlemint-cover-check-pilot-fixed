/**
 * Signed Cover Check links for a WhatsApp campaign audience.
 *   npm run links:batch -- audience.csv [campaign-name]   → writes audience-with-links.csv
 *
 * Input CSV columns: mobile,name[,door]   (door: get | check | company | review; default check)
 * Output adds: link_token (paste into the template's dynamic URL button, e.g. https://covercheck.../?t={{1}})
 *              and link_url (the full link, for testing).
 * Each link only works for that mobile number and expires after LINK_TOKEN_TTL_DAYS.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import { linkTokenService } from '../services/linkTokenService.js';

const DOORS = ['get', 'check', 'company', 'review'] as const;
type DoorT = (typeof DOORS)[number];

const [file, campaign = `wa-${new Date().toISOString().slice(0, 10)}`] = process.argv.slice(2);
if (!file) { console.error('Usage: npm run links:batch -- audience.csv [campaign-name]'); process.exit(1); }

const tokens = linkTokenService(env.LINK_TOKEN_SECRET, env.LINK_TOKEN_TTL_DAYS);
const lines = (await readFile(file, 'utf8')).split(/\r?\n/).filter((l) => l.trim());
const head = lines[0]!.toLowerCase().split(',').map((x) => x.trim());
const iM = head.indexOf('mobile'), iD = head.indexOf('door');
if (iM < 0) { console.error('The CSV needs a "mobile" column.'); process.exit(1); }

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const out = [[...lines[0]!.split(','), 'link_token', 'link_url'].join(',')];
let ok = 0, skipped = 0;
for (const line of lines.slice(1)) {
  const cols = line.split(',');
  const digits = (cols[iM] ?? '').replace(/\D/g, '');
  const mobile = digits.length === 10 ? `+91${digits}` : digits.length === 12 && digits.startsWith('91') ? `+${digits}` : null;
  const doorRaw = (iD >= 0 ? cols[iD]?.trim().toLowerCase() : '') || 'check';
  if (!mobile || !DOORS.includes(doorRaw as DoorT)) { skipped++; out.push([...cols, '', ''].map(csv).join(',')); continue; }
  const t = tokens.issue({ m: mobile, d: doorRaw as DoorT, c: campaign });
  out.push([...cols, t, `${env.PUBLIC_BASE_URL}/?t=${t}`].map(csv).join(','));
  ok++;
}
const dest = file.replace(/\.csv$/i, '') + '-with-links.csv';
await writeFile(dest, out.join('\n') + '\n');
console.log(`${ok} links written to ${dest}${skipped ? ` · ${skipped} rows skipped (bad mobile or door)` : ''}`);
