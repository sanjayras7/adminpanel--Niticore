# Niticore — Project Overview

## What It Is

Niticore is a **B2B compliance/GRC (Governance, Risk & Compliance) management platform**. It helps companies manage compliance frameworks (ISO 27001, SOC 2, etc.) and serves two distinct audiences through one codebase:

1. **Internal staff** — an admin panel for running the business (sales, support, tenant ops, framework/control authoring)
2. **Customer tenants** — organizations onboarded onto the platform to manage their own compliance posture

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Database | PostgreSQL via Sequelize ORM |
| Auth | Magic links + mandatory TOTP 2FA (internal staff), magic links (customers) |
| Session | Hashed session tokens, JWT bearer for frontend, header-based for backend-to-backend |
| Security | AES-256-GCM encrypted TOTP secrets, bcrypt, role-based permission matrix |

## User Populations

| | Internal Staff | Customer Tenants |
|---|---|---|
| Routes | `(internal)/...`, `api/v1/internal/...` | `organizations/...`, `tenants/...` |
| Roles | Super Admin, Implementation Manager, Customer Success, Support, Finance/Admin, Engineering, Read-only Auditor | Org-scoped users |
| Auth | Magic link + TOTP 2FA | Magic link |

## Core Domain Model

**Compliance:**
- `Framework` → `FrameworkVersion` → `FrameworkSection` → `FrameworkClause`
- `Control` → `ControlVersion` → `ControlImplementationStep` / `ControlEvidenceType`
- `ControlFrameworkMapping` — maps controls to framework clauses
- `ControlRiskMapping` — maps controls to organizational risks
- `TenantFrameworkConfig` — which frameworks are active for a given org

**Organizations & Sales:**
- `Organization` — a customer tenant
- `OrganizationModuleConfig` — feature modules enabled per tenant
- `Lead` / `LeadNote` — sales pipeline records
- `LegalDocument` — NDAs/contracts with e-sign provider integration

**Platform Operations:**
- `TenantProvisioningLog` / `TenantProvisioningDetail` — tracks tenant setup steps
- `InternalUser` / `InternalRole` / `InternalSession` — staff accounts and sessions
- `ImpersonationSession` — time-boxed support impersonation of a tenant
- `InternalAuditEvent` — audit trail for sensitive actions
- `MagicLink` — shared auth-token model for both staff and customer login
- `Notification` — internal notifications

## End-to-End Flow

1. **Lead capture** — a prospect submits the public lead form (`api/public/leads`), creating a `Lead`.
2. **Sales pipeline** — Lead moves through New → Contacted → Demo → Negotiation → NDA/Contract signed (`LegalDocument`) → **Converted to Tenant**.
3. **Tenant provisioning** — conversion creates an `Organization` and runs provisioning steps logged in `TenantProvisioningLog`/`TenantProvisioningDetail` (success/failure per resource).
4. **Org lifecycle** — `Draft → Pending Setup → Active → Suspended / Churned / Archived`, governed by `TENANT_TRANSITIONS` rules and role-gated terminal-state changes.
5. **Compliance configuration** — active orgs get frameworks assigned via `TenantFrameworkConfig`; controls satisfy framework clauses and map to risks.
6. **Ongoing tenant ops** — staff manage tenants via `tenants/[orgId]/...`: toggle modules, view summaries, run actions (resend invite, reset onboarding, force-verify domain, disable tenant, unlock user), reprovision failed setups.
7. **Support & impersonation** — Support staff start a time-boxed `ImpersonationSession` to act as a customer, surfaced to the customer via an impersonation banner; auto-expires and is fully audited.
8. **Audit trail** — sensitive mutations (status changes, tenant actions, impersonation) write `InternalAuditEvent` records with before/after values, actor, reason, IP, and user-agent.

## Authentication Flow (Internal Staff)

1. Staff enters email at `/auth/login` → backend issues a `MagicLink` (token + OTP, 30-min expiry) → email sent.
2. Link/OTP consumed → if TOTP not yet enrolled, redirected to `/auth/enroll-totp` (QR code via speakeasy, secret stored AES-256-GCM encrypted).
3. TOTP verified → `InternalSession` created (64-char hex token, SHA256-hashed in DB, absolute + idle expiry) → `internal_session` cookie set.
4. Subsequent requests authenticate via `Authorization: Bearer <JWT>` (frontend) or `x-internal-user-id` header (backend-to-backend).
5. Role permissions enforced per-action via `permission-matrix.ts`; sensitive actions require a documented reason.

## Route Map (high level)

```
src/app/
├── (internal)/                # Internal staff pages: controls, frameworks, leads, wizard
├── organizations/              # Tenant org detail pages
├── tenants/                    # Tenant provisioning/setup pages
├── auth/                       # login, enroll-totp, verify-magic-link, verify-totp
├── api/v1/internal/            # Staff-facing API: auth, controls, frameworks, leads,
│                                #   organizations, tenants, contracts, gates, impersonation
└── api/public/leads/           # Public lead submission endpoint
```

## Why This Matters for Recent Work

The `[orgId]` dynamic route segment (recently unified across `organizations/` and `tenants/` API routes — previously a mix of `[id]`, `[orgId]`, `[organizationId]` that broke Next.js route resolution) sits at the center of tenant lifecycle management: status transitions, module toggles, and admin actions all key off that single organization identifier.
