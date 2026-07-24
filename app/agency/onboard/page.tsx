import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getAgencySettings } from '@/lib/billing';
import OnboardWizard from '../OnboardWizard';

export default async function OnboardPage() {
  const session = await getSession();
  if (!session) redirect('/agency/install');
  if (session.installMode !== 'agency') redirect('/dashboard');

  const settings = await getAgencySettings();
  const companyId = (settings as any)?.whop_company_id || null;

  const plans = await query<any[]>(
    `SELECT id, name, slug, price_monthly, price_yearly, max_locations, features, trial_days
     FROM agency_plans
     WHERE is_active = 1
       AND (company_id = ? OR company_id IS NULL)
     ORDER BY price_monthly ASC`,
    [companyId]
  );

  const defaultProvider = (settings as any)?.route_subscription || 'payfast';
  const whopEnabled = Boolean((settings as any)?.whop_api_key && (settings as any)?.whop_company_id);

  return (
    <OnboardWizard
      plans={plans}
      defaultProvider={defaultProvider}
      whopEnabled={whopEnabled}
    />
  );
}
