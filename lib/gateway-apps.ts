export type GatewayApp = 'combined' | 'payfast' | 'whop' | 'swich';

export function normalizeGatewayApp(value: string | null | undefined): GatewayApp {
  if (value === 'payfast' || value === 'whop' || value === 'swich') return value;
  return 'combined';
}

export function isolateProviderAvailability(
  app: GatewayApp,
  available: { payfast: boolean; whop: boolean; swich?: boolean },
) {
  if (app === 'payfast') {
    return {
      payfast: available.payfast,
      whop: false,
      swich: false,
      routing: { oneoff: 'payfast' as const, subscription: 'payfast' as const },
    };
  }
  if (app === 'whop') {
    return {
      payfast: false,
      whop: available.whop,
      swich: false,
      routing: { oneoff: 'whop' as const, subscription: 'whop' as const },
    };
  }
  if (app === 'swich') {
    return {
      payfast: false,
      whop: false,
      swich: !!available.swich,
      routing: { oneoff: 'swich' as const, subscription: 'swich' as const },
    };
  }
  return null;
}
