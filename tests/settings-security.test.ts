import fs from 'node:fs';
import path from 'node:path';

describe('settings API security', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/api/settings/route.ts'), 'utf8');

  test('has no unauthenticated preview or demo bypass', () => {
    expect(source).not.toContain("searchParams.get('preview')");
    expect(source).not.toContain("searchParams.get('demo')");
    expect(source).not.toContain('bypassMode');
  });

  test('never selects or returns stored password hashes', () => {
    expect(source).not.toMatch(/SELECT\s+username\s*,\s*password/i);
    expect(source).not.toContain('login_password');
  });

  test('marks credential responses as no-store', () => {
    expect(source).toContain("'Cache-Control': 'private, no-store, max-age=0'");
  });
});
