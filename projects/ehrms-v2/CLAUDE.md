# eHRMS — Angular Frontend

Angular frontend for the HRMS system, consuming the `employee` Spring Boot backend (`http://localhost:8082`, package `com.hrms`, port 8082 — see that project's `CLAUDE.md`).

## Workspace context

This is **one of three apps in a single Angular CLI workspace** (`C:\angular-workspace`), not a standalone project:

- `projects/ehrms-v2` — this app
- `projects/e-invoicing`
- `projects/mss-invoice`

They share one root `package.json`, one root `tsconfig.json` (with per-app `tsconfig.app.json`/`tsconfig.spec.json` references), and one `angular.json` with all three registered as separate `projectType: application` entries. Dependency versions are shared workspace-wide — bumping a package for `ehrms-v2` affects the other two apps too, so check before upgrading.

Run commands **scoped to this project** with the `--project`/positional flag, e.g.:
```
ng serve ehrms-v2
ng build ehrms-v2
ng test ehrms-v2
```
Running a bare `ng serve`/`ng build` without specifying the project may target the wrong app.

## Stack

- **Angular 21.2** (`@angular/core` ^21.2.0), standalone-component architecture (no `NgModule`s — bootstrapped via `app.config.ts`)
- **SSR enabled**: `app.config.server.ts`, `app.routes.server.ts`, `main.server.ts`, `server.ts`, build `outputMode: "server"`. Serve the SSR build with `npm run serve:ssr:ehrms-v2` (runs `dist/ehrms-v2/server/server.mjs`). Routing and any browser-only API usage (e.g. `window`, `localStorage`) need SSR-safety checks (`isPlatformBrowser`) since code also runs on the server.
- **UI**: Angular Material 21.2.7 + CDK (`material-theme.scss` + `styles.css` both loaded as global styles)
- **i18n**: `@ngx-translate/core` + `@ngx-translate/http-loader` — translations loaded at runtime, not Angular's built-in i18n pipeline
- **Charts**: both `@swimlane/ngx-charts` (25.x) and `chart.js` + `ng2-charts` (10.x) are dependencies — check which one an existing feature already uses before adding a new chart, to avoid mixing both libraries in the same screen
- **Dates**: `date-fns`
- **HTTP/reactive**: RxJS 7.8, no NgRx or other global state library present — state is handled per-feature via services (see Conventions)
- **TypeScript 5.9**, **strict mode on**: `strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, plus Angular's `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers` — write fully-typed code; don't quiet errors with `any` or non-null assertions as a shortcut.
- **Testing**: `@angular/build:unit-test` builder (Vitest under the hood, not Karma/Jasmine) + `jsdom`. Use Vitest conventions/matchers when writing or reading spec files.
- **Formatting**: Prettier 3.8 is a dependency — run it rather than hand-formatting.
- Component selector prefix: **`app`**

## Environments

`environment.ts` (dev): `serviceUrl: 'http://localhost:8082'` — matches the `employee` backend's port. There will be a corresponding `environment.prod.ts` (not shown here) for the production API URL; always read `serviceUrl` from the environment file, never hardcode `localhost:8082` in a service.

## Folder structure (`projects/ehrms-v2/src/app`)

```
app/
├── app.config.ts / app.config.server.ts   # bootstrap config (client / SSR)
├── app.routes.ts / app.routes.server.ts   # root routing (client / SSR)
├── app.ts / app.html / app.css / app.spec.ts
│
├── core/                     # singleton, app-wide concerns
│   ├── auth/                 # auth-routing.ts, auth.ts (core auth service/state)
│   ├── guards/                auth.guard.ts
│   ├── interceptors/          jwt.interceptor.ts   (attaches JWT to outgoing requests)
│   └── services/               menu.service.ts
│
├── features/                 # feature/domain modules — mirrors backend modules
│   ├── admin/                 # admin-only config screens, each a self-contained sub-feature:
│   │   ├── document-types/
│   │   ├── holiday-calendar/
│   │   ├── leave-types/
│   │   ├── office-locations/
│   │   └── work-shifts/
│   │       each: models/, pages/<page-name>/{*.ts,*.html,*.css}, services/
│   ├── attendance/            attendance-routing.ts, models/, pages/{attendance-log,
│   │                          attendance-request, attendance-request-approval,
│   │                          attendance-summary, overtime-approval, overtime-request}/,
│   │                          services/{attendance,overtime,regularization}.service.ts
│   ├── auth/                  auth-routing.ts, change-password/, login/  (feature-level auth UI —
│   │                          distinct from core/auth, which holds shared auth state/routing glue)
│   ├── dashboard/              single page, no sub-structure
│   ├── employee/               employee-routing.ts, models/{address,document,employee,identity,
│   │                          job-details}.model.ts, pages/{employee-addresses, employee-detail,
│   │                          employee-documents, employee-form, employee-identity, employee-list,
│   │                          job-details}/, services/{address,document,employee,identity,
│   │                          job-details}.service.ts
│   ├── leave/                 models/{leave-balance,leave-request}.model.ts,
│   │                          pages/{leave-apply, leave-approval, leave-balance, leave-calendar,
│   │                          leave-list}/, services/{leave-balance,leave-request}.service.ts
│   └── payroll/                payroll-routing.ts, models/payroll.model.ts,
│                              pages/{employee-salary, salary-component, salary-structure}/,
│                              services/payroll.service.ts
│
└── layout/                    shell chrome, not a routed feature
    ├── main-layout/
    ├── sidebar/
    └── toolbar/
```

Backend module correspondence: `employee`, `leave`, `payroll`, `attendance`, `auth` feature folders map directly to the same-named backend modules (`com.hrms.employee`, `com.hrms.leave`, `com.hrms.payroll`, `com.hrms.attendance`, `com.hrms.auth`). `admin` here is frontend-only config UI (document types, holiday calendar, leave types, office locations, work shifts) — check the backend for which of those has a matching controller before assuming a new admin screen needs new backend work.

## Conventions

- **Standalone components, no NgModules.** New components/pages follow the existing per-page folder pattern: `pages/<page-name>/<page-name>.ts` + `.html` + `.css` (no `.spec.ts` per page currently, only at the app root — match existing sibling files' testing coverage rather than assuming a pattern).
- **File naming**: no `.component`/`.service`/`.guard` suffix convention is fully consistent — e.g. `employee.ts` (service) vs `employee.service.ts` elsewhere, `document-type.ts` used for both a model and (in a different folder) a service. Check the sibling files in the same folder before naming a new file, rather than assuming one global suffix rule.
- **Each feature is self-contained**: `models/` (interfaces/types), `pages/` (routed screen components), `services/` (HTTP calls + feature state), plus a `<feature>-routing.ts` for lazy-loaded routes. Mirror this shape for any new feature rather than inventing a different structure.
- **State management**: no NgRx/Signal-store library is installed — feature services (in each `services/` folder) own their own state via RxJS. Don't introduce NgRx or another state library without first checking whether the existing per-service pattern already covers the need.
- **Auth flow**: `core/interceptors/jwt.interceptor.ts` attaches the JWT to outgoing HTTP requests; `core/guards/auth.guard.ts` protects routes; `core/auth/auth.ts` likely holds the shared auth/session service. `features/auth` holds the actual login/change-password UI pages. Keep this split — shared auth plumbing in `core/auth`, UI screens in `features/auth`.
- **i18n**: new user-facing strings go through `@ngx-translate` (translation keys), not hardcoded text, to stay consistent with the rest of the app.
- **Charts**: check whether the screen you're extending already uses `ngx-charts` or `chart.js`/`ng2-charts` and stay consistent within that feature rather than mixing libraries on the same page.

## Working in this repo

- Primary working directory for this app: `C:\angular-workspace\projects\ehrms-v2` (part of the larger `C:\angular-workspace` CLI workspace — see Workspace context above).
- Dev server: `ng serve ehrms-v2` (serves against `environment.ts`'s `serviceUrl`, `http://localhost:8082` — the `employee` backend must be running).
- When an API contract changes in the `employee` backend (DTO shape, new endpoint, validation rule), update the matching `features/<feature>/models/*.model.ts` and `services/*.service.ts` here to match.
- Follow strict TypeScript settings already enabled — don't relax `tsconfig.json` to silence a type error; fix the type instead.

---

## UI Redesign — active initiative (ehrms-v2)

`ehrms-v2` is a copy of the original eHRMS app, created so the UI can be redesigned without risking the working original. This section applies to every redesign task. Where it conflicts with the "API contract" bullet above, **this section wins for redesign work** (redesign tasks never change models or services).

### Context

- HRMS for Oman/GCC SMEs. Standalone components, SSR enabled, Angular Material.
- Bilingual English/French/Arabic with full RTL support, using `@ngx-translate` (see i18n convention above).
- Users: HR admins and managers (data-heavy screens: tables, forms, approval queues) and employees (self-service: leave, payslips, attendance).
- Tone: professional, calm, trustworthy. Dense but readable, not flashy.

### Hard constraints (never break these)

**Scope**
- Work only inside `projects/ehrms-v2`. Never modify `projects/ehrms` (if it still exists), `projects/e-invoicing`, `projects/mss-invoice`, or the shared root `package.json`/`tsconfig.json`.
- Do not add npm dependencies without asking first (dependencies are shared workspace-wide).

**Do not edit**
- Services, models, guards, interceptors, routing files (`*-routing.ts`, `app.routes*.ts`), `environments/`, or any TypeScript business logic.
- Do not rename routes, component selectors, form control names, or template bindings that call existing component methods/properties.

**Allowed to change**
- `material-theme.scss`, `styles.css`, any shared SCSS partials, component HTML templates, component CSS, and the layout components (`layout/main-layout`, `layout/sidebar`, `layout/toolbar`).
- In component `.ts` files, only what is needed to import additional Material modules or add presentational-only properties. No logic changes.
- Translation JSON files: add new keys when needed; never rename or delete existing keys.

**Build and runtime**
- Keep each component's styles within the build budget (7kB warning / 14kB error). Put shared styling in the global theme/partials, not repeated per component.
- SSR-safe: no direct `window`/`document`/`localStorage` access without an `isPlatformBrowser` check.
- Keep strict TypeScript clean: no `any`, no non-null assertions to silence errors.

**RTL and i18n**
- Use CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-*`, `text-align: start`) instead of `left`/`right`, so RTL works without per-component overrides.
- Mirror directional icons (chevrons, arrows, back buttons) in RTL.
- Choose an Arabic-capable font that pairs with the Latin font; for Arabic, don't apply letter-spacing and use a more generous line-height.
- No hardcoded user-facing text; use translation keys.

**Accessibility**
- WCAG 2.1 AA contrast, visible focus states, 44px minimum touch targets, full keyboard navigation, respect `prefers-reduced-motion`.

### Workflow (phased — stop at each checkpoint)

**Phase 1 — Design system (STOP for approval before changing any file)**
1. Use the `ui-ux-pro-max` skill to select a design system suited to an enterprise HR product: style, color palette (primary, secondary, semantic success/warning/error, plus status colors for ACTIVE / PENDING / APPROVED / REJECTED), typography pairing (including the Arabic font), spacing scale, radius, elevation, and motion rules.
2. Present 2 options with a one-line rationale each, recommend one, and show the tokens (colors, fonts, spacing) in a short table.
3. Wait for my choice before touching any file.

**Phase 2 — Foundation**
- Implement the approved system in `material-theme.scss` using Material 3 theming. Check the installed `@angular/material` version in `package.json` (currently 21.2.x) and use the matching theming API.
- Define design tokens as CSS custom properties (colors, spacing, radius, shadows) with a light and a dark theme.
- Wire Arabic font loading and RTL typography adjustments.
- Restyle global Material components once at theme level: buttons, form fields, tables, dialogs, chips/status badges, tabs, snackbars, paginator.

**Phase 3 — Layout shell**
- Redesign `main-layout`, `sidebar` and `toolbar`: collapsible sidebar, responsive (drawer on mobile), active-route highlighting, user menu, EN/AR language toggle, RTL mirroring. Keep the role/menu-driven navigation (`core/services/menu.service.ts`) as-is.

**Phase 4 — Screens (one feature at a time, in this order)**
Login → Dashboard → Employee (list, detail, form, addresses, identity, documents, job details) → Leave → Attendance → Payroll → Admin.
For each feature: consistent page header, data tables with sticky header and clear empty/loading/error states, forms with inline validation, status badges. After each feature run `ng build ehrms-v2 --configuration development` and fix errors before moving on. Keep chart screens on the library they already use.

### Output expectations

- After each phase, give a short summary: files changed, anything skipped, and anything that needs my decision.
- At the end of each phase, confirm with `git status` that changes are only under `projects/ehrms-v2/`.
- Prefer reusing Angular Material components over building custom ones; keep changes minimal and consistent.
- Format changed files with Prettier.
