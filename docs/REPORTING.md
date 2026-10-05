# Analysis, audit and data access

Deploy the matching backend reporting PR before this admin build. The admin loads effective permissions from `/api/reports/access/me` on login, page focus and every 60 seconds. Server authorization is enforced on every request; role names or cached client permissions never grant report access.

Superadmin opens **Data access** to assign existing staff accounts:

- Users, rides/drivers, finance/withdrawals/quality, operations/referrals/demand/support/KYC each have their own scope.
- PDF and Excel XLSX downloads require separate export permissions.
- Audit sensitive fields require separate permission; passwords, tokens and secrets remain redacted.
- Access management can be delegated by superadmin. Other managers cannot grant scopes they do not hold.
- Individual report grants replace inherited report permissions. Empty selection revokes reporting but leaves other staff privileges unchanged.

Existing stored roles are preserved; superadmin must explicitly grant new scopes or update roles. Role permissions and assignments remain available in **Staff & roles**. Backend rollout instructions and metric definitions are in its `docs/REPORTING.md`.

## Pages

**Data analysis** includes 11 report sections, KPI cards, preceding-period comparison, count bars, daily trend charts, category rings, verification workflow, driver rankings, approximate demand plot and paginated detail tables. Dates use Africa/Kigali and a maximum 366-day range. Charts summarize date/cohort data; status/ID filters narrow detail rows, as labelled. Table sorting applies to the visible page only.

**Audit** includes date/action/actor/target filtering, action and daily charts, safe before/after details, linked record timelines, and permitted ride/transaction records. Historic changes without snapshots are labelled “Not recorded”. Audit has no edit/delete control.

**Data access** searches staff by name (50 results maximum), assigns clear labelled scopes, and displays custom success/error feedback.

PDF/XLSX exports include summary tables and up to 2,000 filtered detail records; cap and total are disclosed. Demand is grouped into 0.01-degree cells with at least five bookings, not individual locations. Wallet discrepancies are labelled review candidates, not proven accounting errors. Missing historic telemetry is disclosed rather than invented.

## Validation

Run `pnpm typecheck` and `pnpm build`. Corresponding backend tests verify permission isolation, redaction, typed Excel dates/numbers and PDF generation; an opt-in replica-set integration suite verifies aggregates, authorization, audited exports and revocation.

Local browser verification requires a browser installation. The build does not replace staging checks with a real staff login and production-like MongoDB replica set.
