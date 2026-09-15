import fs from 'node:fs';

const ci = process.argv.includes('--ci');
const requiredFiles = [
  'scripts/payfast-ghl-app.sql',
  'scripts/whop-ghl-app.sql',
  'scripts/whop-standalone-app.sql',
  'scripts/whop-ghl-provider-compliance-migration.sql',
  'scripts/swich-standalone-app.sql',
  'PAYFAST-GHL-APP-SETUP.md',
  'WHOP-GHL-APP-SETUP.md',
  'SWICH-GHL-APP-SETUP.md',
];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const groups = {
  payfast: ['PAYFAST_GHL_CLIENT_ID', 'PAYFAST_GHL_CLIENT_SECRET'],
  whop: ['WHOP_GHL_CLIENT_ID', 'WHOP_GHL_CLIENT_SECRET'],
  swich: ['SWICH_GHL_CLIENT_ID', 'SWICH_GHL_CLIENT_SECRET'],
};
const missingEnv = Object.fromEntries(Object.entries(groups).map(([provider, keys]) => [provider, keys.filter((key) => !process.env[key])]));
const invalidUrl = !/^https?:\/\//.test(String(process.env.NEXT_PUBLIC_APP_URL || ''));

console.log(JSON.stringify({ missingFiles, missingEnv, invalidAppUrl: invalidUrl, mode: ci ? 'ci' : 'deployment' }, null, 2));
if (missingFiles.length || invalidUrl || (!ci && Object.values(missingEnv).some((keys) => keys.length))) process.exit(1);
