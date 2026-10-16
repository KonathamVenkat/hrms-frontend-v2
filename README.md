# hrms-frontend-v2

Angular frontend for the eHRMS system: the redesigned UI (Aurora Glass design). It talks to the `employee`
Spring Boot backend, whose address comes from `projects/ehrms-v2/src/environments`.

Single-app Angular CLI workspace, app name `ehrms-v2` (Angular 21, Angular Material, ngx-translate, SSR).

```bash
npm ci
npm start          # ng serve ehrms-v2, http://localhost:4200 (backend on http://localhost:8082)
npm run build      # ng build ehrms-v2
npm test           # ng test ehrms-v2
```

Before a production deploy, set `serviceUrl` in `projects/ehrms-v2/src/environments/environment.prod.ts`.
See `projects/ehrms-v2/CLAUDE.md` for the project conventions.
