# MOTA Admin Web App

React and Tailwind operations dashboard for MOTA staff.

Roles: Super admin, Admin, Financial, Agent and Caller support. The full permission catalog is in `src/permissions.ts`. The frontend hides unauthorized actions, while the backend must enforce each permission and record all staff actions in its audit log.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_URL` to the backend `/api` URL.
