# Overview logic review

Implemented fixes from inspected source:

- Both overview API endpoints require analytics:view; avoid requests and show an access explanation when that permission is absent.
- Clear the affected dataset after failed refresh rather than retaining obsolete figures as live data. Retain successful independent results.
- Ignore outdated responses and responses after unmount; disable refresh while loading.
- Display the refresh-attempt time and partial failure status.
- Only link to queues with the relevant permission. Registration links require both frontend registration:view and backend user:view.

Follow-ups proposed from this review, not a verified inventory of missing system features:

- Reconcile frontend registration:view versus the backend registration-list user:view requirement before changing existing staff access.
- Add a scoped driver readiness diagnostic in user details showing phone, payment, KYC and administrator activation blockers together.
- Review queue response freshness and provider settlement timing against live operations before adding promises or SLA counters.

Validation: admin TypeScript and production build. Browser and authenticated role/API checks remain pending.
