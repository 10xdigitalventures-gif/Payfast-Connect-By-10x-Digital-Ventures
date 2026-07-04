#!/usr/bin/env node
/**
 * Phase 0 — GHL SaaS API Verification Script
 *
 * This script verifies critical assumptions BEFORE we build the agency-billing app.
 * It tests 4 things:
 *
 *   1. Can we read an agency token from our DB?
 *   2. Does GET /saas-api/.../wallet-balance return real data?
 *   3. Does POST /saas-api/.../wallet-balance/complimentary-credits actually
 *      increase the location's wallet balance (NOT just complimentary credits)?
 *   4. Does GET /saas/locations work to list sub-accounts?
 *
 * Usage:
 *   node scripts/phase0-verify-saas.js <locationId>
 *
 * Example:
 *   node scripts/phase0-verify-saas.js abc123XYZsub-acct
 *
 * Requirements:
 *   - .env file with DB credentials
 *   - Agency OAuth must have been completed at least once
 *     (i.e. an installations row with role=agency or company_id set must exist)
 *   - The test sub-account (locationId arg) should be a SaaS-enabled location
 *     under the agency's company
 */

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const GHL_BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(c, ...args) {
  console.log(`${colors[c] || ''}${args.join(' ')}${colors.reset}`);
}

function header(text) {
  console.log('');
  log('blue', '═'.repeat(70));
  log('bold', text);
  log('blue', '═'.repeat(70));
}

function pass(text)  { log('green', '✓ PASS:', text); }
function fail(text)  { log('red',   '✗ FAIL:', text); }
function warn(text)  { log('yellow', '⚠ WARN:', text); }
function info(text)  { log('gray',  '  ', text); }

const results = {
  step1_db_token: null,
  step2_get_balance: null,
  step3_post_balance: null,
  step4_list_subaccounts: null,
  errors: [],
};

async function getDb() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  return conn;
}

async function getAgencyToken(db) {
  // Look for any installation row that has a company_id set
  // (agency installs populate company_id alongside location_id)
  const [rows] = await db.execute(
    `SELECT location_id, company_id, access_token, refresh_token, expires_at
     FROM installations
     WHERE company_id IS NOT NULL AND company_id != ''
     ORDER BY created_at DESC
     LIMIT 5`
  );
  return rows;
}

async function refreshTokenIfNeeded(row) {
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: row.access_token, refreshed: false };
  }

  info('Token expired or near-expiry, attempting refresh...');
  const clientId = process.env.AGENCY_GHL_CLIENT_ID || process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.AGENCY_GHL_CLIENT_SECRET || process.env.GHL_CLIENT_SECRET;

  const res = await fetch(`${GHL_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return {
    accessToken: data.access_token || data.accessToken,
    refreshed: true,
  };
}

async function ghlCall(method, urlPath, token, body = null) {
  const url = urlPath.startsWith('http') ? urlPath : `${GHL_BASE}${urlPath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, ok: res.ok, data, raw: text };
}

async function step1_loadToken() {
  header('STEP 1 — Load agency token from DB');
  const db = await getDb();
  try {
    const rows = await getAgencyToken(db);
    if (!rows.length) {
      fail('No agency tokens found in installations table.');
      info('Make sure you have completed agency OAuth at least once.');
      info('The installation row must have company_id populated.');
      results.step1_db_token = false;
      return null;
    }

    info(`Found ${rows.length} candidate row(s) with company_id:`);
    rows.forEach((r, i) => {
      info(`  [${i + 1}] location=${r.location_id}  company=${r.company_id}  expires=${new Date(r.expires_at).toISOString()}`);
    });

    const target = rows[0];
    pass(`Using row: location=${target.location_id} company=${target.company_id}`);

    const { accessToken, refreshed } = await refreshTokenIfNeeded(target);
    if (refreshed) info('Token was refreshed (write the new token back to DB in real code).');

    results.step1_db_token = true;
    return { token: accessToken, companyId: target.company_id, locationId: target.location_id };
  } finally {
    await db.end();
  }
}

async function step2_getWalletBalance(token, companyId, locationId) {
  header('STEP 2 — GET wallet balance for a location');
  info(`Endpoint: GET /saas-api/public-api/companies/${companyId}/locations/${locationId}/wallet-balance`);

  const r = await ghlCall(
    'GET',
    `/saas-api/public-api/companies/${companyId}/locations/${locationId}/wallet-balance`,
    token
  );

  info(`HTTP ${r.status}`);
  console.log(colors.gray + '  Response:', JSON.stringify(r.data, null, 2).slice(0, 800) + colors.reset);

  if (r.status === 401 || r.status === 403) {
    fail(`Not authorized (${r.status}) — likely missing saas/location.read scope.`);
    results.errors.push('Step 2: insufficient scope for wallet-balance GET');
    results.step2_get_balance = false;
    return null;
  }
  if (r.status === 404) {
    fail('404 — endpoint not found. Possibly location is not SaaS-enabled, or endpoint requires different shape.');
    results.errors.push('Step 2: 404 on wallet-balance GET');
    results.step2_get_balance = false;
    return null;
  }
  if (!r.ok) {
    fail(`Unexpected response: ${r.status}`);
    results.errors.push(`Step 2: HTTP ${r.status} on wallet-balance GET`);
    results.step2_get_balance = false;
    return null;
  }

  pass('GET wallet-balance returned 200 OK with structured data.');

  // Look at the response carefully to understand the data model
  const d = r.data || {};
  const candidates = [
    'balance', 'walletBalance', 'wallet_balance',
    'complimentary', 'complimentaryCredits', 'complimentary_credits',
    'totalBalance', 'available',
  ];
  const found = {};
  for (const k of candidates) {
    if (d[k] !== undefined) found[k] = d[k];
    if (d.data?.[k] !== undefined) found[`data.${k}`] = d.data[k];
    if (d.resource?.[k] !== undefined) found[`resource.${k}`] = d.resource[k];
  }
  if (Object.keys(found).length) {
    info('Detected balance-related fields:');
    Object.entries(found).forEach(([k, v]) => info(`  ${k} = ${JSON.stringify(v)}`));
  } else {
    warn('No obvious balance field detected in response. Inspect the raw output above.');
  }

  results.step2_get_balance = true;
  return r.data;
}

async function step3_updateBalance(token, companyId, locationId, beforeData) {
  header('STEP 3 — Attempt to increase wallet balance by $0.01 (test)');
  info(`Endpoint: POST /saas-api/.../wallet-balance/complimentary-credits`);
  warn('This will charge nothing on PayFast — we are calling GHL directly to see if it adds credit.');

  // Per AIP-134 partial updates docs, "updateMask" is used to specify which fields change.
  // We'll try the most likely payload shape; if it fails we'll fall back to alternates.

  const payloads = [
    {
      name: 'shape A — flat balance increment',
      body: {
        balance: 0.01,
        updateMask: 'balance',
      },
    },
    {
      name: 'shape B — complimentary credits increment',
      body: {
        complimentaryCredits: 0.01,
        updateMask: 'complimentaryCredits',
      },
    },
    {
      name: 'shape C — wrapped resource',
      body: {
        resource: { balance: 0.01 },
        updateMask: 'balance',
      },
    },
  ];

  let success = false;
  let lastResp = null;
  for (const p of payloads) {
    info('');
    info(`Trying: ${p.name}`);
    info(`  Body: ${JSON.stringify(p.body)}`);
    const r = await ghlCall(
      'POST',
      `/saas-api/public-api/companies/${companyId}/locations/${locationId}/wallet-balance/complimentary-credits`,
      token,
      p.body
    );
    info(`  HTTP ${r.status}`);
    console.log(colors.gray + '  Response:', JSON.stringify(r.data, null, 2).slice(0, 400) + colors.reset);
    lastResp = r;
    if (r.ok) {
      pass(`Payload "${p.name}" succeeded with ${r.status}.`);
      success = true;
      break;
    }
    if (r.status === 401 || r.status === 403) {
      fail('Authorization rejected — missing scope or wrong token type.');
      results.errors.push(`Step 3: ${r.status} on POST wallet-balance`);
      break;
    }
  }

  if (!success) {
    fail('None of the payload shapes were accepted.');
    results.errors.push('Step 3: no payload shape worked for wallet-balance POST');
    results.step3_post_balance = false;
    return;
  }

  // Now re-read the balance to see what actually changed
  info('');
  info('Re-reading wallet balance to observe what changed...');
  await new Promise((r) => setTimeout(r, 1500));
  const after = await ghlCall(
    'GET',
    `/saas-api/public-api/companies/${companyId}/locations/${locationId}/wallet-balance`,
    token
  );
  console.log(colors.gray + '  After-state:', JSON.stringify(after.data, null, 2).slice(0, 800) + colors.reset);

  // Compare to before
  const before = beforeData || {};
  function dig(o, k) { return o?.[k] ?? o?.data?.[k] ?? o?.resource?.[k]; }
  const fieldChanges = {};
  for (const k of ['balance', 'walletBalance', 'complimentary', 'complimentaryCredits']) {
    const a = dig(after.data, k);
    const b = dig(before, k);
    if (a !== undefined || b !== undefined) {
      fieldChanges[k] = { before: b, after: a, diff: (a ?? 0) - (b ?? 0) };
    }
  }
  info('Field-level changes:');
  console.log(colors.gray + '  ', JSON.stringify(fieldChanges, null, 2) + colors.reset);

  // Decide if "real wallet balance" was affected vs only "complimentary"
  const balanceChanged = (fieldChanges.balance?.diff || fieldChanges.walletBalance?.diff || 0) > 0;
  const onlyComplimentaryChanged = (fieldChanges.complimentary?.diff || fieldChanges.complimentaryCredits?.diff || 0) > 0
    && !balanceChanged;

  if (balanceChanged) {
    pass('REAL wallet balance increased — we CAN use this for paid recharges.');
    info('✅ Architecture confirmed: charge PayFast → call this endpoint → GHL deducts SMS/email.');
    results.step3_post_balance = 'paid_recharge_works';
  } else if (onlyComplimentaryChanged) {
    warn('Only the COMPLIMENTARY credit increased — not the actual paid balance.');
    info('❌ This endpoint is for free credits only. Paid recharge needs a different mechanism.');
    info('   Fallback: keep our own internal wallet and call GHL update-rebilling to charge at GHL rates.');
    results.step3_post_balance = 'complimentary_only';
  } else {
    warn('Could not detect a clear change. Inspect raw response above.');
    results.step3_post_balance = 'unclear';
  }
}

async function step4_listSubAccounts(token, companyId) {
  header('STEP 4 — GET /saas/locations to list SaaS sub-accounts');

  // Two known paths from docs — try the newer one first
  const candidates = [
    `/saas-api/public-api/companies/${companyId}/locations`,
    `/saas-api/public-api/locations`,
    `/saas/locations?companyId=${companyId}`,
    `/saas/locations`,
  ];

  for (const p of candidates) {
    info(`Trying: GET ${p}`);
    const r = await ghlCall('GET', p, token);
    info(`  HTTP ${r.status}`);
    if (r.ok) {
      const list = r.data?.locations || r.data?.data || r.data?.resources || r.data;
      const count = Array.isArray(list) ? list.length : 'unknown';
      pass(`Endpoint works! Returned ${count} locations.`);
      if (Array.isArray(list) && list[0]) {
        info('  Sample item keys: ' + Object.keys(list[0]).slice(0, 10).join(', '));
      }
      results.step4_list_subaccounts = p;
      return p;
    }
    if (r.status !== 404) {
      console.log(colors.gray + '  Response:', JSON.stringify(r.data, null, 2).slice(0, 300) + colors.reset);
    }
  }
  fail('No working path found for listing SaaS sub-accounts.');
  results.errors.push('Step 4: no path returned 200 for sub-account list');
  results.step4_list_subaccounts = false;
}

async function main() {
  console.log('');
  log('bold', '╔══════════════════════════════════════════════════════════════════╗');
  log('bold', '║      GHL SaaS API — Phase 0 Verification                         ║');
  log('bold', '╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const argLocationId = process.argv[2];
  if (!argLocationId) {
    warn('No locationId passed as argument.');
    info('Usage: node scripts/phase0-verify-saas.js <test_sub_account_locationId>');
    info('Script will still run STEP 1, but STEP 2/3 need a real SaaS-enabled location.');
  }

  try {
    const auth = await step1_loadToken();
    if (!auth) {
      printSummary();
      process.exit(1);
    }

    if (!argLocationId) {
      warn('Skipping STEP 2/3 because no locationId was provided.');
    } else {
      const beforeBalance = await step2_getWalletBalance(auth.token, auth.companyId, argLocationId);
      if (results.step2_get_balance) {
        await step3_updateBalance(auth.token, auth.companyId, argLocationId, beforeBalance);
      }
    }

    await step4_listSubAccounts(auth.token, auth.companyId);
  } catch (err) {
    console.error('');
    log('red', '✗ Script error:', err.message);
    if (err.stack) console.error(colors.gray + err.stack + colors.reset);
    results.errors.push(err.message);
  } finally {
    printSummary();
  }
}

function printSummary() {
  header('VERIFICATION SUMMARY');
  const rows = [
    ['Step 1 — Agency token available in DB',     results.step1_db_token],
    ['Step 2 — GET wallet-balance works',         results.step2_get_balance],
    ['Step 3 — POST wallet-balance behavior',     results.step3_post_balance],
    ['Step 4 — List sub-accounts works',          results.step4_list_subaccounts],
  ];
  for (const [label, val] of rows) {
    const symbol = val === true || (typeof val === 'string' && val !== false && val !== 'complimentary_only')
      ? `${colors.green}✓${colors.reset}`
      : val === false
      ? `${colors.red}✗${colors.reset}`
      : val === 'complimentary_only'
      ? `${colors.yellow}~${colors.reset}`
      : `${colors.gray}-${colors.reset}`;
    console.log(`  ${symbol} ${label.padEnd(50)} ${typeof val === 'string' ? colors.gray + val + colors.reset : ''}`);
  }
  if (results.errors.length) {
    console.log('');
    log('red', 'Issues to investigate:');
    results.errors.forEach((e) => info(`- ${e}`));
  }
  console.log('');

  // Architecture verdict
  log('bold', 'ARCHITECTURE VERDICT:');
  if (results.step3_post_balance === 'paid_recharge_works') {
    log('green', '✓ Plan A — Use GHL wallet (update-location-wallet-balance for paid recharges).');
  } else if (results.step3_post_balance === 'complimentary_only') {
    log('yellow', '~ Plan B — Use GHL update-rebilling for billing control + maintain our own internal wallet.');
    info('  GHL controls SMS/email rates via rebilling config; we charge customers; track usage separately.');
  } else if (results.step3_post_balance === false) {
    log('red', '✗ Plan C — GHL SaaS API not accessible. Use External Billing webhook + agency dashboard.');
    info('  Customers pay us, we mark subscription paid via /oauth/billing/webhook. No wallet API needed.');
  } else {
    log('gray', '?  Re-run with a real SaaS-enabled locationId to determine verdict.');
  }
  console.log('');
}

main();