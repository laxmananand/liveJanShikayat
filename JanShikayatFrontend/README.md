# Jan Shikayat — Frontend Template (no backend)

The complete Angular 18 frontend of the Jan Shikayat grievance portal, running
**without any backend or database**. Every API call is answered in the browser
by a mock layer with static credentials and seed data, so all screens work
end-to-end: public landing page, online complaint registration (with CAPTCHA),
public tracking, officer login, dashboard, complaint entry, tracking, detail
actions (remark / forward / action taken / close) and user management.

The UI, routes, components and styles are unchanged from the original
`JanShikayat/frontend`. Only the service layer was replaced.

## Run

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/
```

## Login credentials (static, frontend only)

Defined in [`src/app/core/mock/mock-credentials.ts`](src/app/core/mock/mock-credentials.ts).
The login page has one-click buttons for each.

| Role | Email | Password | Scope |
|---|---|---|---|
| Super Admin | `admin@janshikayat.gov.in` | `Admin@12345` | Sees everything, creates users |
| Branch Officer | `branchofficer1@janshikayat.gov.in` | `Branch@12345` | Branch 1 complaints, registers complaints |
| Department Head | `homedept.head@janshikayat.gov.in` | `Dept@12345` | गृह विभाग complaints, forward / close |
| Competent Authority | `sdo1@janshikayat.gov.in` | `Authority@12345` | Field-enquiry complaints, action taken |

Users created on the **User Management** screen can also log in (stored in the browser).

For public tracking, try `JS{current year}0001` to `JS{current year}0012`, for example `JS20260004`.

## How the mock works

```
src/app/core/
├── mock/                     ← DELETE this folder once real APIs are plugged in
│   ├── mock-credentials.ts   static login accounts
│   ├── mock-data.ts          branches, departments, authorities, seed complaints
│   └── mock-db.service.ts    in-browser "database" + latency/error helpers
└── services/                 ← the ONLY files components talk to
    ├── auth.service.ts       login / logout / register
    ├── complaint.service.ts  officer complaint APIs + dashboard
    ├── lookup.service.ts     dropdown lookups
    └── public.service.ts     citizen tracking, CAPTCHA, online submission
```

- **Persistence:** complaint data is saved to `localStorage` (key `js_mock_db_v1`),
  so it survives page reloads. To restore the seed data, run
  `localStorage.removeItem('js_mock_db_v1')` in the browser console and reload.
- **Uploaded PDFs** are kept in memory only. After a reload, or for seed documents,
  the viewer shows a generated sample PDF.
- **Business rules** match the old backend: role-scoped complaint visibility,
  role checks on each action, status transitions, audit history, `JS{year}{0001}`
  complaint numbers, and single-use 5-minute CAPTCHAs.
- **Errors** come back as real `HttpErrorResponse`s (401, 403, 404, and 400 with
  `{ message }` / `{ code: 'CAPTCHA_INVALID' }`), so the components' existing
  error handling keeps working.
- Each call has about 350 ms of simulated latency (`MOCK_LATENCY_MS`), so loading
  states are visible.

## Plugging in the real APIs (later)

`HttpClient` and the JWT `authInterceptor` are still registered in `app.config.ts`.
To switch over:

1. Set `apiUrl` in `src/environments/environment*.ts`.
2. In each service, replace the method bodies with `HttpClient` calls. Every
   method has a comment naming the old REST endpoint it stood in for, for example
   `/** API: GET /complaints/{id} */`. Keep the method signatures if you can, so
   components don't need changes.
3. If the new API uses different response shapes, update `core/models/models.ts`
   (or map responses inside the services).
4. Delete `src/app/core/mock/`, and remove the `MOCK_USERS` demo buttons from
   `features/auth/login/login.component.ts`.
