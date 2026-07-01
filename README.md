# Niticore Super Admin Panel

Internal admin panel for managing the full customer lifecycle: lead intake → NDA/contract → tenant onboarding → ongoing support and governance configuration.

## Getting Started

### Prerequisites

- **Node.js** >= 18.x (LTS recommended)
- **PostgreSQL** >= 16
- **npm** (ships with Node.js)

### Clone and Install

```bash
git clone https://github.com/sanjayras7/adminpanel--Niticore.git
cd adminpanel--Niticore
npm install
```

### Environment Setup

Copy the example env file and fill in the values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your local PostgreSQL connection string and generate the required secrets:

```bash
# Generate the encryption key
openssl rand -hex 32

# Generate a random JWT secret
openssl rand -base64 32
```

### Database Setup

Create the development database in PostgreSQL:

```bash
createdb niticore_dev
```

Run migrations and seed the database:

```bash
npm run db:migrate
npm run db:seed:dev
```

Or for a clean slate (drops and recreates everything):

```bash
npm run db:reset:dev
```

### Start the App

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Test Users

After seeding, the following test users are available (all with `totp_enabled: false` — first login will trigger TOTP enrollment):

| Email | Role |
|---|---|
| super-admin@niticore-test.internal | Super Admin |
| implementation-manager@niticore-test.internal | Implementation Manager |
| customer-success@niticore-test.internal | Customer Success |
| support@niticore-test.internal | Support |
| finance-admin@niticore-test.internal | Finance/Admin |
| engineering@niticore-test.internal | Engineering |
| read-only-auditor@niticore-test.internal | Read-only Auditor |

### Seeded Data

The seed script also creates:

- **5 sample leads** — Acme Corp, Beta Ltd, Gamma Inc, Delta Co, Echo LLC (in various statuses from New to Ready for Onboarding)
- **2 sample organizations** — Pilot Tenant (Active) and Draft Tenant (Draft)
- **2 sample frameworks** — SOC 2 and ISO 27001, each with 3 control sections
