# Niticore Super Admin Panel — Manual Testing Guide

## Overview

This guide walks a tester through manually verifying every module of the Niticore
Super Admin Panel, step by step, as a real internal user would. Each module section
includes prerequisites, numbered action steps with expected results, database
verification queries, and common failure modes.

> **Note:** The placeholder values in angle brackets (`<like-this>`) must be replaced
> with actual IDs from your database. Run the seed script first to populate test data,
> then fill in the IDs before starting each module.

---

## Prerequisites

### Database State

- PostgreSQL 16 instance running with the Niticore admin panel schema applied.
- All migrations have been run (`node src/lib/migrations/run.js`).
- The seed script has been executed to create test users and seed data.
- The app is running locally (`npm run dev` or equivalent).

### Test Users

| User | Email | Role | Used For |
|------|-------|------|----------|
| Super Admin | `<super-admin-email>` | Super Admin | Admin-only actions, TOTP resets, overrides |
| Support | `<support-email>` | Support | Impersonation testing |
| Finance/Admin | `<finance-admin-email>` | Finance/Admin | Access restriction verification |
| Implementation Manager | `<impl-manager-email>` | Implementation Manager | Tenant provisioning |
| Customer Success | `<cs-email>` | Customer Success | View-only scenarios |
| Engineering | `<engineering-email>` | Engineering | Provisioning retry |
| Read-only Auditor | `<auditor-email>` | Read-only Auditor | Read-only verification |

### Seeded Leads

| Company | Status | Notes |
|---------|--------|-------|
| Acme Corp | New | For filtering and duplicate tests |
| Beta Ltd | Qualified | For NDA/contract and override tests |
| Gamma Inc | Contacted | General purpose |
| Delta LLC | New | General purpose |
| Epsilon Co | Qualified | General purpose |

### Seeded Tenant

- **Active Pilot Tenant** (status: `active_pilot`) — for tenant detail and operations testing.

---

## Module 1: Authentication and MFA

### Prerequisites

- The app server is running.
- No active session for the test user (clear cookies/session storage).
- Test user exists in `internal_users` table with TOTP not yet enrolled.

### Steps

1. Open a private/incognito browser window.

2. Navigate to `/internal/auth/login`.
   - **Expected:** The login page renders with an email input field. The page displays
     the Niticore branding and a "Sign in with magic link" instruction.

3. Enter the Super Admin test email address and click "Send Magic Link".
   - **Expected:** A success message appears: "If an account exists, a magic link has
     been sent." The response does NOT reveal whether the email exists in the system
     (no existence leak).

4. Enter a completely unknown email address (e.g., `nonexistent@example.com`) and click
   "Send Magic Link".
   - **Expected:** The same generic success message appears: "If an account exists, a
     magic link has been sent." The response is identical to step 3 — an external
     observer cannot distinguish valid from invalid emails.

5. Open the database and find the magic link token for the Super Admin user:

   ```sql
   SELECT token, otp, email, purpose, consumed_at, expires_at
   FROM magic_links
   WHERE email = '<super-admin-email>'
     AND purpose = 'login'
     AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - **Expected:** A row is returned with a token, a 6-character OTP, and `expires_at`
     in the future.

6. In the login page, enter the email again. On the OTP entry step, enter the 6-digit
   OTP from the `magic_links` row.
   - **Expected:** The page transitions to TOTP enrollment. A QR code is displayed.
     A manual enrollment key is also shown.

7. Scan the QR code with an authenticator app (e.g., Google Authenticator, Authy) or
   manually enter the key.
   - **Expected:** The authenticator app adds the Niticore entry and begins generating
     6-digit codes.

8. Enter the 6-digit TOTP code from the authenticator app.
   - **Expected:** The dashboard loads successfully. The URL changes to
     `/internal/dashboard`. The user's name and role ("Super Admin") are displayed in
     the header.

9. Sign out by clicking the user menu in the header and selecting "Sign Out".
   - **Expected:** The session is cleared. The browser redirects to `/internal/auth/login`.

10. Without logging in, attempt to navigate directly to `/internal/dashboard`.
    - **Expected:** The browser redirects back to `/internal/auth/login`. The dashboard
      content is never rendered.

### Database Verification

```sql
SELECT * FROM internal_sessions
WHERE internal_user_id = '<super-admin-id>'
ORDER BY created_at DESC
LIMIT 1;
```


**Expected:** A session row exists with `created_at` matching the login time.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| "Invalid or expired link" on OTP entry | OTP expired (5-minute window). Regenerate by starting over. |
| QR code does not render | Browser console shows JS/dependency error. Check network tab for failed asset loads. |
| TOTP code rejected | Clock skew between server and authenticator app. Verify server time is NTP-synced. |
| Redirect loop on dashboard | Session cookie not set or expired immediately. Check `internal_sessions` table for the session. |

---

## Module 2: RBAC

### Prerequisites

- Super Admin user has TOTP enrolled and an active session.
- Finance/Admin user has TOTP enrolled and an active session.
- The seed data includes multiple internal roles.

### Steps

1. Log in as the Finance/Admin user (TOTP flow, same as Module 1).

2. Navigate to `/internal/audit-logs`.
   - **Expected:** HTTP 403 is returned, or a "Not Authorized" message is displayed.
     The page does not render audit log data.

3. Navigate to `/internal/leads`.
   - **Expected:** The leads list renders successfully. Finance/Admin has read access
     to leads.

4. Attempt to create a lead note via the UI (try the "Add Note" button or form on a
   lead detail page).
   - **Expected:** The action is blocked. Either the button is hidden (UI courtesy) or
     the API call returns 403. Even if the UI hides the button, verify the API rejects
     the mutation by inspecting the network tab.

5. Sign out and log back in as Super Admin.

6. Navigate to the Internal Users management page. Find the Finance/Admin user and
   change their role from "Finance/Admin" to "Customer Success".
   - **Expected:** The role change is accepted. A success message appears.

7. Verify the audit event was created:

   ```sql
   SELECT * FROM internal_audit_events
   WHERE action = 'role_change'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - **Expected:** A row exists with `after_values` containing the new role
     ("Customer Success") and `before_values` containing the old role ("Finance/Admin").

8. (Optional, time-permitting) Log in as the now-Customer-Success user and confirm
   audit-logs access is still blocked but lead creation remains read-only.

### Database Verification

```sql
SELECT * FROM internal_audit_events
WHERE action = 'role_change'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** `actor_internal_user_id` matches the Super Admin user. `before_values`
contains `{"role": "Finance/Admin"}`. `after_values` contains `{"role": "Customer Success"}`.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Finance/Admin can see audit logs | RBAC middleware not checking role for this route. Check `requireRoles()` call. |
| Role change does not create audit event | `writeAuditEvent()` not called in the role-update handler. |
| UI button hidden but API still accepts mutation | Server-side authorization missing. The UI hiding a button is a courtesy — server must also reject. |

---

## Module 3: Audit and Activity Timeline

### Prerequisites

- Super Admin user is logged in.
- At least one lead exists in the database.

### Steps

1. Navigate to a lead's detail page (e.g., Acme Corp at `/internal/leads/<acme-id>`).
   Confirm the page loads.

2. Create a lead note: add an internal note such as "Test note for audit verification".
   - **Expected:** The note appears in the lead's activity timeline with a timestamp
     and the actor's name.

3. Change the lead's status (e.g., from "New" to "Contacted").
   - **Expected:** The status change appears in the activity timeline. The previous and
     new status values are shown.

4. Navigate to `/internal/audit-logs`.
   - **Expected:** The global audit log shows events from this session, including
     the note creation and status change. Each event has an action name, actor,
     timestamp, and target reference.

5. Verify the events are in chronological order (newest first).
   - **Expected:** The top of the list shows the most recent action. Scrolling or
     paginating backwards shows older events.

### Database Verification

```sql
SELECT action, created_at, actor_internal_user_id
FROM internal_audit_events
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** At least 3 rows corresponding to the note creation, status change, and
audit log view (if that action is tracked). Timestamps are in descending order. The
`actor_internal_user_id` matches the Super Admin user.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Activity timeline shows nothing | Activity timeline query not wired to `internal_audit_events` for this target type. |
| Events in wrong order | `ORDER BY` in the query is `ASC` instead of `DESC`, or pagination offset is incorrect. |
| Missing actor name | The timeline query does not JOIN `internal_users` to resolve the name. |

---

## Module 4: Shell and Navigation

### Prerequisites

- Both Super Admin and Finance/Admin users have active sessions.

### Steps

1. Log in as Super Admin. Observe the sidebar/navigation panel.
   - **Expected:** All navigation items are visible. The full set of internal modules
     is listed (Dashboard, Leads, Tenants, Frameworks, Audit Logs, Notifications,
     Internal Users, Settings, etc. — covering the 15 module areas).

2. Count the nav items.
   - **Expected:** 11 nav items are visible.

3. Sign out and log in as Finance/Admin.
   - **Expected:** The sidebar/navigation shows a reduced set. The "Audit Logs" nav
     item is absent. Fewer than 11 items are visible.

4. Confirm the "INTERNAL" badge is visible in the page header at all times (both
   Super Admin and Finance/Admin views).
   - **Expected:** A badge or label reading "INTERNAL" is displayed somewhere in the
     header area (e.g., next to the logo or in the top bar).

5. Click the user menu in the top-right corner of the header.
   - **Expected:** The dropdown shows the user's full name and their current role
     (e.g., "Jane Doe — Super Admin" or "John Smith — Finance/Admin").

6. Resize the browser to a viewport width under 640px (use DevTools responsive mode).
   - **Expected:** The sidebar collapses. A hamburger menu icon (three horizontal
     lines) appears in the header. Clicking the hamburger icon opens the nav as an
     overlay or drawer.

7. From the user menu, select "Sign Out".
   - **Expected:** The session is cleared. The browser redirects to
     `/internal/auth/login`. Attempting to use the browser "Back" button does not
     restore the dashboard.

### Database Verification

```sql
SELECT * FROM internal_sessions
WHERE internal_user_id IN ('<super-admin-id>', '<finance-admin-id>')
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** The most recent session for each user is active. After sign-out, the
session row should be deleted or marked as expired.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Wrong nav items for role | Navigation component reads role from server response but mapping is stale/incomplete. |
| INTERNAL badge missing | Badge conditionally rendered based on `window.location` instead of auth state. |
| Mobile sidebar does not collapse | Missing responsive CSS breakpoint or missing `useMediaQuery` hook. |
| Sign out does not clear session | API call to invalidate session is not firing, or only removing client cookie without server-side invalidation. |

---

## Module 5: Lead CRM

### Prerequisites

- Super Admin user is logged in.
- The seed script has created 5 leads: Acme Corp, Beta Ltd, Gamma Inc, Delta LLC,
  Epsilon Co.

### Steps

1. Navigate to `/internal/leads`.
   - **Expected:** The page shows a list of all 5 seeded leads. Each row shows the
     company name, contact name, status, and created date.

2. Apply a filter by status "New".
   - **Expected:** The list filters to show only leads with status "New". Only Acme
     Corp and Delta LLC appear (or whichever leads were seeded as "New").

3. Clear the filter. Search by company name "Beta" in the search box.
   - **Expected:** The list filters to show only Beta Ltd. The search is case-insensitive
     and matches partial strings.

4. Click on Acme Corp to open its detail page (`/internal/leads/<acme-id>`).
   - **Expected:** The full detail view renders, showing:
     - Profile section: company name, website, country, region
     - Contact information: name, email, phone
     - Activity timeline section (may be at the bottom)

5. In the activity timeline area, add an internal note (e.g., "Initial contact made").
   - **Expected:** The note appears in the timeline immediately with a timestamp and
     the actor's name (Super Admin).

6. Change the lead's status from "New" to "Contacted".
   - **Expected:** The status updates. An audit event is logged. The timeline shows
     the status change with old and new values.

7. Submit a new lead via the public form using the same company domain as Acme Corp
   (e.g., "Another Acme Corp" with domain `acme.com`).
   - **Expected:** The API response includes a `potential_duplicate_ids` field
     containing the ID of Acme Corp. (The public form may show a warning or simply
     return the flag in the background.)

### Database Verification

```sql
SELECT potential_duplicate_ids FROM leads
WHERE company_name = '<new lead name>';
```

**Expected:** The `potential_duplicate_ids` JSONB field contains an array with at
least one entry — the UUID of Acme Corp.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Fewer than 5 leads shown | Seed script did not create all 5 leads, or filter is inadvertently active. |
| Search returns no results | Search query uses exact match instead of ILIKE/partial match. |
| Duplicate detection not triggered | Domain normalization is stripping subdomains incorrectly, or comparison logic does not match the public form domain. |
| Note not appearing in timeline | Optimistic UI update failed; refresh the page to confirm it was saved. |

---

## Module 6: E-Sign Adapter

### Prerequisites

- Provider sandbox credentials configured (if available).
- Super Admin user is logged in.

### Notes

This module is infrastructure-level and has no direct user-facing page. Verification
is done via API test rather than UI navigation.

### Steps

1. Confirm the adapter interface exists and is correctly wired.

   - Check that the e-sign provider interface/abstract class is implemented.
   - Confirm the adapter accepts a standardized request shape (signer info, document
     payload, callback URL).

2. **If sandbox credentials are available:**

   a. Send a POST request to the e-sign adapter's create/send endpoint with test
      signer details.

   b. Confirm the provider returns a valid envelope/request ID.

   c. Confirm the adapter returns a normalized status (e.g., `sent`, `pending`,
      `delivered`).

   d. Poll the status (or wait for webhook) to confirm the provider reports status
      changes.

3. **If sandbox credentials are NOT available:**

   - Document this as "Requires provider sandbox access" and skip the live test.
   - Verify that the adapter code compiles and imports correctly (no missing
     dependencies or type errors).

### Database Verification

```sql
SELECT id, provider_name, provider_envelope_id, provider_status, platform_status
FROM legal_documents
WHERE document_type = 'contract'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** If a live test was performed, a row exists with the provider response
data. If skipped, no new row is expected.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Adapter not found | Missing import or incorrect DI wiring in the module registry. |
| Provider returns error | Sandbox credentials expired, incorrect API endpoint, or network restriction. |
| Status never updates | Webhook handler not registered with provider, or webhook URL is not publicly reachable in dev. |

---

## Module 7: NDA and Contract

### Prerequisites

- Super Admin user is logged in.
- Beta Ltd lead exists with status "Qualified".
- E-sign adapter is configured (mock or sandbox).

### Steps

1. Open the Beta Ltd lead detail page (`/internal/leads/<beta-ltd-id>`).

2. In the NDA section, mark NDA as "Required".
   - **Expected:** The NDA status changes to "Required". A prompt to send the NDA
     document appears.

3. Attempt to schedule a demo (look for a "Schedule Demo" button or action).
   - **Expected:** The action is blocked. A message indicates that the NDA must be
     signed before a demo can be scheduled. The NDA gate is active.

4. As Super Admin, use the override feature to bypass the NDA gate. Provide a reason
   (e.g., "Executive override — customer requested urgent demo").
   - **Expected:** The override is accepted. The demo scheduling is now unblocked.

5. Confirm the override appears in the activity timeline.
   - **Expected:** The timeline shows a "Gate override" entry with the reason text.

6. In the Contracts section, send a contract using the mock or sandbox provider.
   - **Expected:** The contract is sent. The status shows as "Sent" or "Pending".

7. Attempt to set the tenant status to "Active" (navigate to the tenant's settings
   from the lead or the tenant management page).
   - **Expected:** The action is blocked. A message indicates that a signed contract
     is required. The contract gate is active.

### Database Verification

```sql
SELECT * FROM gate_overrides
WHERE lead_id = '<beta-ltd-id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** A row with `gate_type` = `nda` (or similar), `overridden_by` = Super
Admin's user ID, and `reason` containing the text entered in step 4.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| NDA gate does not block demo | Gate check middleware not wired for the demo-scheduling endpoint. |
| Override not working | Override check queries `gate_overrides` but does not match the correct `gate_type` or `lead_id`. |
| Override not in timeline | Timeline query does not include `gate_overrides` events. |
| Contract gate does not block Active | Contract gate check missing from the tenant status-change handler. |

---

## Module 8: Onboarding Wizard

### Prerequisites

- Super Admin user is logged in.
- A Qualified lead exists (Beta Ltd) for the prefill test.

### Steps

1. Navigate to the "Create New Tenant" entry point (likely a button or link labeled
   "New Tenant" or "Onboard Organization").

2. The onboarding wizard appears. Complete all 7 steps with test data:

   | Step | Fields to Fill |
   |------|---------------|
   | 1 — Customer Profile | Company name, website, country, region |
   | 2 — Plan | Select a plan tier |
   | 3 — Lifecycle | Set initial status (e.g., `onboarding`) |
   | 4 — Admin | Enter an admin email, name |
   | 5 — Modules | Select modules to enable |
   | 6 — Frameworks | Select applicable frameworks |
   | 7 — Integrations | Configure any integration settings |

   After each step, click "Next" and confirm the wizard advances.

3. On the final review step (Step 7 or a separate "Review" step), confirm the
   contract gate status is displayed.
   - **Expected:** The review screen shows the current state of the contract gate
     (likely "No signed contract" or "Gate: Active").

4. Attempt to set the tenant status to "Active" on the review screen.
   - **Expected:** This is blocked. A message indicates that a signed contract is
     required before the tenant can be set to Active.

5. Start the wizard again, but this time use the "Start from Lead" option (or navigate
   to Beta Ltd's lead page and click a "Convert to Tenant" action). Confirm the wizard
   pre-fills fields from the lead data.
   - **Expected:** Company name, contact info, and other lead fields are pre-filled
     in the wizard. The wizard skips or auto-fills steps that have complete data.

6. Complete the wizard from the lead-prefill start. Confirm the organization record
   is created.

### Database Verification

```sql
SELECT id, name, status FROM organizations
WHERE name = '<your test tenant name>';
```

**Expected:** A row exists with the name you entered. The status matches what you
selected (e.g., `onboarding`).

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Wizard stuck on a step | Client-side validation failing on a required field. Check browser console. |
| Prefill does not populate | Lead-to-wizard prefill mapping missing a field transformation. |
| Organization not created | Wizard submit handler fails silently. Check server logs for the error. |
| Contract gate status missing | The review step query does not include the gate check. |

---

## Module 9: Provisioning Monitoring

### Prerequisites

- Super Admin user is logged in.
- A tenant exists with at least one provisioning attempt (successful or failed).
- Engineering user is logged in (separate session for role-specific tests).

### Steps

1. Navigate to a tenant's provisioning status page
   (`/internal/tenants/<tenant-id>/provisioning`).
   - **Expected:** The page displays provisioning log entries. Each entry has a
     timestamp, status (success/failed/in-progress), and a message.

2. If a failed provisioning exists, click on the error detail.
   - **Expected:** The full error message is visible. Technical details (e.g.,
     stored function name, error code) are shown.

3. Log in as Engineering user in a separate browser/incognito window.

4. Navigate to the same tenant's provisioning status page. Click the "Retry" button.
   - **Expected:** The retry action succeeds. The server calls
     `niticore_reprovision_tenant()`. A new provisioning log entry is created with
     status "in-progress" or "success".

5. Log in as Customer Success user. Navigate to the same tenant's provisioning page
   and attempt "Retry".
   - **Expected:** The retry button is either absent or returns HTTP 403. Customer
     Success cannot trigger provisioning retries.

### Database Verification

```sql
SELECT * FROM tenant_provisioning_log
WHERE organization_id = '<tenant-id>'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Rows show the provisioning history. The most recent row (if retried)
shows a new attempt.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Provisioning page shows no entries | Log query does not match the tenant ID, or provisioning never ran. |
| Retry does not call stored function | Handler invokes a different function name or the function does not exist. Check `niticore_reprovision_tenant()`. |
| Customer Success can retry | Role check missing from the retry endpoint's `requireRoles()`. |

---

## Module 10: Tenant Detail and Operations

### Prerequisites

- Super Admin user is logged in.
- Finance/Admin user is logged in (separate session).
- The Active Pilot Tenant exists with status `active_pilot`.

### Steps

1. Navigate to the Active Pilot Tenant's detail page
   (`/internal/tenants/<pilot-tenant-id>`).
   - **Expected:** The page shows the following sections:
     - **Profile:** Company name, website, country, region
     - **Plan:** Current plan tier
     - **NDA/Contract Status:** Status of legal documents (signed, pending, etc.)
     - **Onboarding Checklist:** Progress of onboarding items
     - **Provisioning Status:** Current state of tenant provisioning
     - **Activity Timeline:** Recent events for this tenant

2. Change the tenant's status from "Active" to "Suspended".
   - **Expected:** The status updates. An audit event is logged.

3. Attempt to change the status back from "Suspended" to "Active".
   - **Expected:** The contract gate check runs. If the contract is not signed, the
     action is blocked with a message indicating the contract gate is active.

4. Log in as Finance/Admin user. Navigate to the same tenant's detail page and
   attempt to change the tenant status.
   - **Expected:** HTTP 403 is returned (or the button is absent/disabled). Finance/Admin
     cannot change tenant lifecycle status.

5. Log back in as Super Admin. Add an internal note for the tenant.
   - **Expected:** The note appears in the activity timeline.

### Database Verification

```sql
SELECT status, updated_at FROM organizations
WHERE id = '<pilot-tenant-id>';
```

**Expected:** After step 2, `status` = `suspended`. `updated_at` reflects the change
time.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Tenant detail page missing sections | Page assembly component queries not joined or returning empty results. |
| Status change silently fails | Optimistic update in UI does not match server response — refresh the page. |
| Contract gate not checked on status change to Active | Gate middleware not invoked for the status-change endpoint. |
| Finance/Admin can change status | Role check missing from the tenant status-change handler. |

---

## Module 11: Support and Impersonation

### Prerequisites

- Support user is logged in.
- Super Admin user is logged in (for reference).
- Finance/Admin user is logged in (separate session).
- At least one tenant exists.

### Steps

1. Log in as Support user.

2. Navigate to a tenant's support view (`/internal/tenants/<tenant-id>/support`).
   - **Expected:** The page renders with read-only access. All data is visible, but
     editing controls (buttons, forms) are absent or disabled.

3. Start an impersonation session on a customer admin. Navigate to the impersonation
   UI and select a customer admin user. Enter a reason: "Investigating user-reported
   issue with billing display."
   - **Expected:** The impersonation session starts. The browser now shows the UI as
     the impersonated customer admin would see it.

4. Confirm an impersonation banner is visible in the UI.
   - **Expected:** A colored banner at the top of the page reads something like
     "Impersonating <customer-admin-name> — <reason>". A "Stop Impersonating" button
     is present in the banner.

5. Attempt a mutating action (e.g., edit a record, change a setting).
   - **Expected:** The action is blocked. Even if the UI shows a button, the server
     rejects the mutation (HTTP 422 or 403). Read-only impersonation makes mutation
     genuinely impossible at the API layer.

6. Click "Stop Impersonating" in the banner.
   - **Expected:** The banner disappears. The UI returns to the Support user's normal
     view. The `impersonation_sessions` row has `ended_at` set.

7. Attempt to start an impersonation session **without** providing a reason (leave the
   reason field empty).
   - **Expected:** HTTP 422 is returned. The response includes a validation error
     indicating that a reason is required.

8. Log in as Finance/Admin user. Attempt to start an impersonation session.
   - **Expected:** HTTP 403 is returned. Finance/Admin does not have impersonation
     permissions.

### Database Verification

```sql
SELECT actor_internal_user_id, started_at, ended_at, status
FROM impersonation_sessions
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** A row exists with `actor_internal_user_id` matching the Support user,
`started_at` set, `ended_at` NULL (or set if impersonation was ended), and
`status` = `active` (or `ended`).

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Impersonation banner not showing | Frontend not polling `/internal/impersonation/session-check` on page load. |
| Mutation allowed during impersonation | `checkImpersonationBlock()` middleware not applied to mutation endpoints. |
| Reason not enforced | Validation missing in the impersonation start handler. |
| Finance/Admin can impersonate | `requireRoles()` does not include role check for `POST /impersonation/start`. |

---

## Module 12: Framework and Controls

### Prerequisites

- Super Admin user is logged in.
- Read-only Auditor user is logged in (separate session).
- At least one framework classification exists in seed data.

### Steps

1. Log in as Super Admin.

2. Navigate to the Frameworks section (`/internal/frameworks`).
   - **Expected:** The page shows a list of existing frameworks (if any) or an empty
     state with a "Create Framework" button.

3. Click "Create Framework". Enter a name (e.g., "SOC 2 — Internal Testing") and
   select a classification.
   - **Expected:** The framework is created. A success message appears. The page now
     shows the new framework in the list.

4. Open the newly created framework. Add 2 sections to it (e.g., "Section A: Access
   Control" and "Section B: Data Encryption").
   - **Expected:** Both sections appear in the framework tree/structure.

5. Under Section A, add 3 clauses with descriptive text.
   - **Expected:** All 3 clauses appear nested under Section A in the tree.

6. Edit the framework name (e.g., change it to "SOC 2 — Revised").
   - **Expected:** A new version is created. The old version is preserved. The edit
     screen shows the new draft version.

7. Navigate to the Controls section. Create a new control (e.g., "AC-01: Access
   Review Policy") and map it to one of the framework clauses created in step 5.
   - **Expected:** The control is created. The mapping to the framework clause is
     stored. The control appears when viewing the framework clause.

8. Log out and log in as Read-only Auditor.

9. Navigate to the Frameworks section. Attempt to create a new framework or click the
   "Create Framework" button.
   - **Expected:** The create button is absent or returns HTTP 403. Read-only Auditor
     cannot create or modify frameworks.

### Database Verification

```sql
SELECT id, name FROM framework_versions
WHERE framework_id = '<your framework id>'
ORDER BY created_at;
```

**Expected:** Two (or more) rows: the original version and the new draft version
created by the name edit.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Edit does not create new version | Auto-clone logic not triggered on metadata change of a published version. |
| Clauses not nested under sections | `parent_section_id` not set on creation, or sort order is wrong. |
| Control mapping not visible | Control-to-framework mapping query not filtering by the correct clause ID. |
| Read-only Auditor can still see create button | UI checks role incorrectly, or API does not block the mutation. |

---

## Module 13: Tenant Framework Config

### Prerequisites

- Super Admin user is logged in.
- At least one tenant and one framework exist.
- An unauthorized role user is available (e.g., Finance/Admin).

### Steps

1. Navigate to a tenant's framework configuration page
   (`/internal/tenants/<tenant-id>/frameworks`).
   - **Expected:** The page shows a list of available modules and frameworks.

2. Enable a module for the tenant. Toggle a module switch to "enabled".
   - **Expected:** The `organization_module_config` table is updated. A success
     message appears.

3. Select an applicable framework from the available list.
   - **Expected:** The framework is associated with the tenant. Confirm that it
     references the global framework by foreign key (not a copy of the framework
     data).

4. Navigate to the tenant's activity timeline.
   - **Expected:** The framework config change appears as an audit event with
     details of what was changed.

5. Log in as an unauthorized role (e.g., Finance/Admin). Navigate to the same
   tenant's framework configuration page and attempt to make a change.
   - **Expected:** HTTP 403 is returned. The UI does not allow modifications.

### Database Verification

```sql
SELECT organization_id, framework_id
FROM organization_framework_config
WHERE organization_id = '<tenant-id>';
```

**Expected:** A row exists linking the tenant to the selected framework.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| Module toggle does nothing | API call not reaching the server or the handler does not update `organization_module_config`. |
| Framework selection copies data instead of referencing FK | Implementation copied framework data into a tenant-local table instead of storing FK. |
| Config change not in audit log | Handler does not call `writeAuditEvent()` for framework config changes. |

---

## Module 14: Notifications

### Prerequisites

- Super Admin user is logged in.
- Notification channel is configured (email, Slack, or console logs).
- Multiple test users exist for targeted notification verification.

### Steps

1. Submit a new lead via the public lead intake form. Use a unique email and company
   name.
   - **Expected:** A notification is dispatched. Check the configured channel:
     - **Email:** Check the email logs (or the console if using a mailhog/smtp4dev).
     - **Slack:** Check the designated Slack channel.
     - **Console:** Check the server stdout logs for the notification message.

2. Complete an NDA signing (either via the e-sign provider or by manually simulating a
   signed status in the database for the test lead).
   - **Expected:** A notification is sent. The content mentions that an NDA has been
     signed and for which lead/tenant.

3. As Super Admin, trigger a TOTP reset for a test user (find the TOTP reset action
   in the Internal Users section).
   - **Expected:** A notification is dispatched **specifically to the affected user**,
     not just a general team channel notification. The notification should reference
     the user by name or email.

4. Simulate a notification send failure (e.g., invalid email address, misconfigured
   channel).
   - **Expected:** The underlying action (lead creation, NDA status change, TOTP reset)
     still succeeds. The notification failure is logged but does not roll back the
     action.

### Database Verification

> Exact verification depends on the notification channel configured.
>
> **If using email:** Check the email delivery table or the SMTP server logs.
>
> **If using Slack:** Check the webhook delivery logs or the Slack channel.
>
> **If using console logging:** Check the application logs for `[NOTIFICATION]` entries.

### Common Failure Modes

| Symptom | Likely Cause |
|---------|-------------|
| No notification sent | Notification dispatch handler not wired to the action's completion handler. |
| TOTP reset notification sent to team channel instead of user | Notification routing logic sends to a broadcast channel instead of user-specific address. |
| Action rolled back when notification fails | Notification dispatch error is not caught; the transaction is rolled back. |
| NDA notification not sent | Notification trigger only watches `legal_documents` insert but not update of `platform_status`. |

---

## Known Limitations and Accepted Risks

The following V1 limitations are known and accepted for this project. Tester should
keep them in mind and not report them as bugs:

### 1. Edge Runtime Page-Guard

Unauthorized users may briefly see an empty page shell before being redirected at the
API layer. This is a rendering-order artifact — the client-side check fires before the
server redirect, and the empty shell appears for a fraction of a second. No data is
exposed.

### 2. Optimistic Locking on Role Changes

Concurrent Super Admin role changes could result in stale `before_values` in the audit
log. If two Super Admins change the same user's role simultaneously, the audit log may
record the wrong `before_values` for one of the changes. Acceptable in V1 for the
single-admin pilot.

### 3. TIMESTAMPTZ Inconsistency on `internal_sessions`

The `expires_at` column in `internal_sessions` uses `TIMESTAMP` rather than
`TIMESTAMPTZ`. In production, monitor for timezone-related expiry issues. If the server
timezone shifts (e.g., due to DST or deployment in a different region), session expiry
calculations may be off by the timezone offset.

### 4. In-Memory Rate Limiting

Rate limiter state resets on server restart. All in-flight rate-limit counters are lost.
During restart, users may be able to exceed the intended rate limit for a brief window.
Long-term fix: switch to a persistent store (Redis or database-backed) for rate
limiting.

### 5. Finance/Admin Framework Mutations

Finance/Admin can currently write to framework and control entities. This should be
restricted in a follow-up (likely to Super Admin and Implementation Manager only).
Tester should be aware that this is a known gap, not the intended behavior.

### 6. 403 Denial Audit Logging

Authorization denials (HTTP 403 responses) are not currently logged to
`internal_audit_events`. If a Support or Finance/Admin user is repeatedly hitting a
forbidden endpoint, no audit trail exists. Planned as a follow-up.

### 7. Session Table Cleanup

Expired sessions in `internal_sessions` are not automatically purged. Over time, the
table grows unbounded. A cron job should be added before high-volume production use.

---

## Appendix: Test Data Setup

### Initial Seed Command

```bash
# Run the seed script to populate test data
npm run seed
```

Or, if a dedicated seed script exists:

```bash
node src/lib/seed.js
```

### Quick ID Lookup Queries

```sql
-- Find internal user by email
SELECT id, email, internal_role_id FROM internal_users WHERE email = '<email>';

-- Find a lead by company name
SELECT id, company_name, status FROM leads WHERE company_name ILIKE '%<name>%';

-- Find a tenant by name
SELECT id, name, status FROM organizations WHERE name ILIKE '%<name>%';
```
