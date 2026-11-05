# Original project file inventory

Companion to PROJECT-REVIEW.md. Text source was reviewed by area. Binary assets and lockfiles are identified separately; generated output and third-party dependencies are outside the authored-source review.

## functions

- `functions/.env.example` — Optional Cloud Functions adapter/configuration
- `functions/.env.local` — Optional Cloud Functions adapter/configuration
- `functions/.gitignore` — Optional Cloud Functions adapter/configuration
- `functions/build.mjs` — Optional Cloud Functions adapter/configuration
- `functions/package-lock.json` — Dependency lock metadata
- `functions/package.json` — Optional Cloud Functions adapter/configuration
- `functions/src/index.ts` — Optional Cloud Functions adapter/configuration
- `functions/tsconfig.json` — Optional Cloud Functions adapter/configuration

## scripts

- `scripts/grant-admin.ts` — Local setup, seeding, scheduling, or admin provisioning
- `scripts/local-scheduler.ts` — Local setup, seeding, scheduling, or admin provisioning
- `scripts/seed-emulator.ts` — Local setup, seeding, scheduling, or admin provisioning
- `scripts/start-emulators.mjs` — Local setup, seeding, scheduling, or admin provisioning

## server

- `server/admin.ts` — Trusted backend operation or support helper
- `server/agreements.ts` — Trusted backend operation or support helper
- `server/auctions.ts` — Trusted backend operation or support helper
- `server/conversations.ts` — Trusted backend operation or support helper
- `server/index.ts` — Trusted backend operation or support helper
- `server/lib/admin.ts` — Trusted backend operation or support helper
- `server/lib/agreements.ts` — Trusted backend operation or support helper
- `server/lib/audit.ts` — Trusted backend operation or support helper
- `server/lib/callable.ts` — Trusted backend operation or support helper
- `server/lib/denormalize.ts` — Trusted backend operation or support helper
- `server/lib/errors.ts` — Trusted backend operation or support helper
- `server/lib/http.ts` — Trusted backend operation or support helper
- `server/lib/messages.ts` — Trusted backend operation or support helper
- `server/lib/notify.ts` — Trusted backend operation or support helper
- `server/lib/ops.ts` — Trusted backend operation or support helper
- `server/offers.ts` — Trusted backend operation or support helper
- `server/products.ts` — Trusted backend operation or support helper
- `server/reports.ts` — Trusted backend operation or support helper
- `server/users.ts` — Trusted backend operation or support helper

## shared

- `shared/agreement.ts` — Shared domain types, validation, or business rule
- `shared/auction.ts` — Shared domain types, validation, or business rule
- `shared/categories.ts` — Shared domain types, validation, or business rule
- `shared/errors.ts` — Shared domain types, validation, or business rule
- `shared/index.ts` — Shared domain types, validation, or business rule
- `shared/money.ts` — Shared domain types, validation, or business rule
- `shared/offer.ts` — Shared domain types, validation, or business rule
- `shared/schemas.ts` — Shared domain types, validation, or business rule
- `shared/search.ts` — Shared domain types, validation, or business rule
- `shared/stock.ts` — Shared domain types, validation, or business rule
- `shared/types.ts` — Shared domain types, validation, or business rule
- `shared/units.ts` — Shared domain types, validation, or business rule

## src

- `src/app/(auth)/auth/action/auth-action.tsx` — Page, route layout, or page view
- `src/app/(auth)/auth/action/page.tsx` — Page, route layout, or page view
- `src/app/(auth)/forgot-password/page.tsx` — Page, route layout, or page view
- `src/app/(auth)/layout.tsx` — Page, route layout, or page view
- `src/app/(auth)/login/login-form.tsx` — Page, route layout, or page view
- `src/app/(auth)/login/page.tsx` — Page, route layout, or page view
- `src/app/(auth)/onboarding/onboarding-form.tsx` — Page, route layout, or page view
- `src/app/(auth)/onboarding/page.tsx` — Page, route layout, or page view
- `src/app/(auth)/register/page.tsx` — Page, route layout, or page view
- `src/app/(auth)/register/register-form.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/agreements/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/auctions/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/audit/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/categories/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/errors/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/layout.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/listings/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/reports/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/users/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/admin/verification/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/agreements/[id]/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/agreements/[id]/view.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/agreements/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/auctions/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/bids/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/layout.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/offers/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/buyer/saved/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/auctions/[id]/edit/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/auctions/[id]/edit/view.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/auctions/new/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/auctions/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/layout.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/offers/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/products/[id]/edit/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/products/[id]/edit/view.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/products/new/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/farmer/products/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/layout.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/messages/[id]/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/messages/[id]/view.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/messages/layout.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/messages/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/notifications/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/settings/page.tsx` — Page, route layout, or page view
- `src/app/(dashboard)/shell.tsx` — Page, route layout, or page view
- `src/app/(site)/auctions/[id]/auction-detail.tsx` — Page, route layout, or page view
- `src/app/(site)/auctions/[id]/page.tsx` — Page, route layout, or page view
- `src/app/(site)/auctions/page.tsx` — Page, route layout, or page view
- `src/app/(site)/contact/page.tsx` — Page, route layout, or page view
- `src/app/(site)/farmers/[id]/farmer-profile.tsx` — Page, route layout, or page view
- `src/app/(site)/farmers/[id]/page.tsx` — Page, route layout, or page view
- `src/app/(site)/help/page.tsx` — Page, route layout, or page view
- `src/app/(site)/layout.tsx` — Page, route layout, or page view
- `src/app/(site)/marketplace/marketplace-view.tsx` — Page, route layout, or page view
- `src/app/(site)/marketplace/page.tsx` — Page, route layout, or page view
- `src/app/(site)/page.tsx` — Page, route layout, or page view
- `src/app/(site)/privacy/page.tsx` — Page, route layout, or page view
- `src/app/(site)/products/[id]/page.tsx` — Page, route layout, or page view
- `src/app/(site)/products/[id]/product-detail.tsx` — Page, route layout, or page view
- `src/app/(site)/terms/page.tsx` — Page, route layout, or page view
- `src/app/api/cron/tick/route.ts` — Server HTTP transport
- `src/app/api/rpc/[name]/route.ts` — Server HTTP transport
- `src/app/api/uploads/route.ts` — Server HTTP transport
- `src/app/favicon.ico` — Binary favicon; inventoried
- `src/app/globals.css` — Page, route layout, or page view
- `src/app/layout.tsx` — Page, route layout, or page view
- `src/components/admin/admin-ui.tsx` — Reusable UI or feature component
- `src/components/auctions/auction-card.tsx` — Reusable UI or feature component
- `src/components/auctions/auction-form.tsx` — Reusable UI or feature component
- `src/components/auctions/auction-status.tsx` — Reusable UI or feature component
- `src/components/auctions/auctions-view.tsx` — Reusable UI or feature component
- `src/components/auth/auth-provider.tsx` — Reusable UI or feature component
- `src/components/auth/require-auth.tsx` — Reusable UI or feature component
- `src/components/chat/conversation-list.tsx` — Reusable UI or feature component
- `src/components/chat/thread.tsx` — Reusable UI or feature component
- `src/components/dashboard/widgets.tsx` — Reusable UI or feature component
- `src/components/forms/form-schemas.ts` — Reusable UI or feature component
- `src/components/forms/location-fields.tsx` — Reusable UI or feature component
- `src/components/forms/money-input.tsx` — Reusable UI or feature component
- `src/components/landing/field-illustration.tsx` — Reusable UI or feature component
- `src/components/landing/hero-search.tsx` — Reusable UI or feature component
- `src/components/landing/live-sections.tsx` — Reusable UI or feature component
- `src/components/layout/app-shell.tsx` — Reusable UI or feature component
- `src/components/layout/brand.tsx` — Reusable UI or feature component
- `src/components/layout/site-footer.tsx` — Reusable UI or feature component
- `src/components/layout/site-header.tsx` — Reusable UI or feature component
- `src/components/layout/user-menu.tsx` — Reusable UI or feature component
- `src/components/marketplace/contact-actions.tsx` — Reusable UI or feature component
- `src/components/marketplace/product-card.tsx` — Reusable UI or feature component
- `src/components/offers/agreement-status.tsx` — Reusable UI or feature component
- `src/components/offers/offer-card.tsx` — Reusable UI or feature component
- `src/components/offers/offer-composer.tsx` — Reusable UI or feature component
- `src/components/offers/offer-status.tsx` — Reusable UI or feature component
- `src/components/offers/offers-view.tsx` — Reusable UI or feature component
- `src/components/products/image-uploader.tsx` — Reusable UI or feature component
- `src/components/products/product-form.tsx` — Reusable UI or feature component
- `src/components/products/stock-dialog.tsx` — Reusable UI or feature component
- `src/components/reports/report-dialog.tsx` — Reusable UI or feature component
- `src/components/ui/badge.tsx` — Reusable UI or feature component
- `src/components/ui/button.tsx` — Reusable UI or feature component
- `src/components/ui/card.tsx` — Reusable UI or feature component
- `src/components/ui/dialog.tsx` — Reusable UI or feature component
- `src/components/ui/feedback.tsx` — Reusable UI or feature component
- `src/components/ui/input.tsx` — Reusable UI or feature component
- `src/components/ui/tabs.tsx` — Reusable UI or feature component
- `src/components/ui/toast.tsx` — Reusable UI or feature component
- `src/lib/data/agreements.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/auctions.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/categories.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/chat.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/converters.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/notifications.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/products.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/data/saved.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/firebase/callable.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/firebase/client.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/format.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/hooks/use-server-clock.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/hooks/use-unread-notifications.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/server/auth.ts` — Client data, Firebase, formatting, hook, or auth helper
- `src/lib/utils.ts` — Client data, Firebase, formatting, hook, or auth helper

## tests

- `tests/e2e/auth.spec.ts` — Test scenario or fixture; read, execution status in review
- `tests/e2e/fixtures.ts` — Test scenario or fixture; read, execution status in review
- `tests/e2e/responsive.spec.ts` — Test scenario or fixture; read, execution status in review
- `tests/e2e/scenario-a.spec.ts` — Test scenario or fixture; read, execution status in review
- `tests/e2e/scenario-b.spec.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/admin.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/auctions.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/chat.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/helpers.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/images.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/offers.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/emulator/scheduler.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/rules/firestore.rules.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/unit/auction.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/unit/money-units.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/unit/offer.test.ts` — Test scenario or fixture; read, execution status in review
- `tests/unit/stock.test.ts` — Test scenario or fixture; read, execution status in review

## Root files

- `.env.development` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `.env.example` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `.firebaserc` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `.gitignore` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `AGENTS.md` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `DEPLOY-FREE.md` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `emulators.env` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `eslint.config.mjs` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `farmconnect-fsd.zip` — Separate React/Express archive; not original app source
- `firebase.json` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `firestore.indexes.json` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `firestore.rules` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `next-env.d.ts` — Generated Next.js type references; inspected
- `next.config.ts` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `package-lock.json` — Dependency lock metadata
- `package.json` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `playwright.config.ts` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `README.md` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `storage.rules` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `tsconfig.json` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `vercel.json` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `vitest.config.mts` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed
- `vitest.emulator.config.mts` — Project documentation, environment template, rules, indexes, or tool configuration; reviewed

Excluded generated/dependency artifacts: node_modules/, .next/, tsconfig.tsbuildinfo, Firebase/Firestore debug logs. Existing logs were sampled as local runtime evidence, not as source code. The report does not certify deployed behavior or perform a third-party dependency security audit.
