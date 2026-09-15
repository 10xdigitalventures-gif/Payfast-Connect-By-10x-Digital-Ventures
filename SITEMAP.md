# Application Sitemap & URL Map

## Standalone gateway apps
| App | OAuth callback | Settings | Checkout | Query | Callback/webhook |
| --- | --- | --- | --- | --- | --- |
| PayFast | `/oauth/payfast/callback` | `/apps/payfast/settings` | `/apps/payfast/checkout` | `/api/apps/payfast/query` | `/api/apps/payfast/itn` |
| Whop | `/oauth/whop/callback` | `/apps/whop/settings` | `/apps/whop/checkout` | `/api/apps/whop/query` | `/api/apps/whop/webhook` |
| Swich | `/oauth/swich/callback` | `/apps/swich/settings` | `/apps/swich/checkout` | `/api/apps/swich/query` | `/api/apps/swich/callback` |

## Shared application
| URL | Purpose |
| --- | --- |
| `/dashboard` | CRM dashboard |
| `/billing` | Agency billing overview |
| `/install` | Marketplace install entry |
| `/agency` | Agency console |
| `/apply` | Merchant application |
| `/support` | Support contacts |
| `/docs` | Documentation links |

## Legacy migration routes
`/checkout`, `/payfast-config`, `/oauth/callback`, `/api/ghl/pay`, `/api/payfast/itn`, and the combined settings routes remain temporarily for existing installations. New apps must not use them.
