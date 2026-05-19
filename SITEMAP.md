# Application Sitemap & URL Map

## User / Merchant
| URL | Purpose | Access |
| :--- | :--- | :--- |
| `/dashboard` | CRM dashboard | User |
| `/settings` | GoPayFast credentials and CRM automation | User |
| `/billing` | Agency billing overview | User |
| `/billing/plans` | Billing plans | User |
| `/billing/suspended` | Suspended notice | User |
| `/install` | CRM install flow | Public |
| `/login` | User login | Public |

## Agency
| URL | Purpose | Access |
| :--- | :--- | :--- |
| `/agency` | Agency billing console | Agency |
| `/agency/install` | Agency install flow | Public/Agency |
| `/agency/login` | Agency login | Public |

## Public
| URL | Purpose | Access |
| :--- | :--- | :--- |
| `/apply` | Merchant application form | Public |
| `/support` | Support contacts | Public |
| `/docs` | Documentation links | Public |
| `/pay/[token]` | Public payment page | Public |
| `/pay/success` | Payment success page | Public |
| `/invoice/[token]` | Public invoice page | Public |

## GHL / CRM
| URL | Purpose | Access |
| :--- | :--- | :--- |
| `/checkout` | CRM checkout iframe | CRM |
| `/checkout/success` | CRM success page | CRM |
| `/payfast-config` | CRM provider config page | CRM |
| `/oauth/callback` | OAuth callback endpoint | CRM |

## Admin
| URL | Purpose | Access |
| :--- | :--- | :--- |
| `/admin` | Admin dashboard | Admin |
| `/admin/login` | Admin login | Public |
