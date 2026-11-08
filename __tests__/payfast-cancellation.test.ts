import { NextRequest } from 'next/server';
import { GET } from '../app/api/apps/payfast/itn/route';
import { query } from '../lib/db';
import { verifySignature } from '../lib/payfast';

jest.mock('../lib/db', () => ({ query: jest.fn() }));
jest.mock('../lib/payfast', () => ({
  verifySignature: jest.fn(),
  extractCapturedInstrument: jest.fn(),
}));
jest.mock('../lib/payment-instruments', () => ({ savePaymentInstrument: jest.fn() }));
jest.mock('../lib/payfast-ghl-notify', () => ({ sendPayfastGhlNotification: jest.fn() }));

const queryMock = query as jest.Mock;
const signatureMock = verifySignature as jest.Mock;
const url = 'https://payfast.example.test/api/apps/payfast/itn?location_id=location-A&basket_id=basket-123&redirect=Y&cancelled=Y';

describe('PayFast untrusted cancellation return', () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://payfast.example.test';
    queryMock.mockReset();
    signatureMock.mockReset();
  });
  afterAll(() => {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  });

  it('does not change a pending payment or claim a signature', async () => {
    queryMock.mockResolvedValueOnce([{ id: 5, status: 'pending' }]);
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(String(queryMock.mock.calls[0][0])).toMatch(/^SELECT \*/);
    expect(signatureMock).not.toHaveBeenCalled();
    const html = await response.text();
    expect(html).toContain('Payment cancelled');
    expect(html).toContain('https://payfast.example.test');

    expect(html).not.toContain(",'*')");
  });

  it('never downgrades an already completed payment from a cancelled return', async () => {
    queryMock.mockResolvedValueOnce([{ id: 7, status: 'complete' }]);
    const response = await GET(new NextRequest(url));
    expect((await response.text())).toContain('Payment complete');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
