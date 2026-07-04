import { jest } from '@jest/globals';
import * as db from '../lib/db';
import { NextResponse } from 'next/server';

// We test the DB ownership queries by calling the route handlers directly
// Import routes dynamically to avoid Next.js routing context complexity
const companyRoute = require('../app/api/agency/transactions/company/[companyId]/route.ts');
const locationRoute = require('../app/api/agency/transactions/location/[locationId]/route.ts');

describe('agency ownership checks (unit)', () => {
  beforeEach(() => {
    jest.spyOn(db, 'query').mockImplementation(async (sql: string, params: any[]) => {
      // Simple routing based on inputs for tests
      if (sql.includes('SELECT company_id FROM installations WHERE location_id = ? LIMIT 1')) {
        const loc = params[0];
        if (loc === 'agency-loc') return [{ company_id: 100 }];
        if (loc === 'target-loc') return [{ company_id: 100 }];
        if (loc === 'other-loc') return [{ company_id: 200 }];
        return [];
      }
      return [];
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test('company route forbids if agency missing company', async () => {
    (db.query as any).mockResolvedValueOnce([]); // agency install missing
    const req: any = { nextUrl: new URL('http://localhost') };
    const res = await companyRoute.GET(req, { params: Promise.resolve({ companyId: '100' }) });
    expect(res.status).toBe(401);
  });

  test('location route forbids cross-company access', async () => {
    // agency -> agency-loc company 100, target location other-loc company 200
    (db.query as any).mockImplementationOnce(async () => [{ company_id: 100 }]);
    (db.query as any).mockImplementationOnce(async () => [{ company_id: 200 }]);
    const req: any = { nextUrl: new URL('http://localhost') };
    const response = await locationRoute.GET(req, { params: Promise.resolve({ locationId: 'other-loc' }) });
    expect(response.status).toBe(403);
  });
});
