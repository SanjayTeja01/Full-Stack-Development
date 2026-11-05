# FarmConnect

FarmConnect is a marketplace where farmers sell agricultural produce directly to buyers. Each trade can happen in one of three ways:

- **Fixed-price listings.** A farmer publishes produce with an asking price per unit.
- **Private negotiation.** A buyer and a farmer chat in real time and exchange structured offers and counteroffers.
- **Competitive bidding.** A farmer runs a time-limited auction for part or all of a listing.

When a trade is agreed, FarmConnect records an **agreement** and shows each party the other's contact details. Payment, transport and delivery are arranged directly between them. FarmConnect does not handle money, escrow or logistics.

> **Status:** The app has been built and tested against the Firebase Emulator Suite only. It has **not been deployed**, and it is not connected to a real Firebase project yet. It is designed to run **for free** on Firebase Spark plus Vercel Hobby, with no card needed. See [DEPLOY-FREE.md](DEPLOY-FREE.md) for the step-by-step guide.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Main features](#2-main-features)
3. [Architecture](#3-architecture)
4. [Technology stack](#4-technology-stack)
5. [Folder structure](#5-folder-structure)
6. [Prerequisites](#6-prerequisites)
7. [Installation](#7-installation)
8. [Environment configuration](#8-environment-configuration)
9. [Firebase setup](#9-firebase-setup)
10. [Authentication configuration](#10-authentication-configuration)
11. [Firestore schema](#11-firestore-schema)
12. [Security rules](#12-security-rules)
13. [Required indexes](#13-required-indexes)
14. [Server code and the two backends](#14-server-code-and-the-two-backends)
15. [Local development](#15-local-development)
16. [Emulator usage](#16-emulator-usage)
17. [Testing](#17-testing)
18. [Deployment](#18-deployment)
19. [Known limitations](#19-known-limitations)
20. [Future enhancements](#20-future-enhancements)
21. [Business rules](#21-business-rules)

---

## 1. Project overview

There are three roles:

| Role | Can do |
|---|---|
| **Farmer** | Create and manage listings and stock, chat with buyers, answer and counter offers, run auctions, track agreements, and request verification. |
| **Buyer** | Search and filter listings, save listings and farmers, chat, make offers, bid in auctions, and track agreements. |
| **Administrator** | Suspend or restore accounts, review verification requests, moderate listings, handle reports, inspect and cancel auctions, resolve disputed agreements, manage categories, and read the audit log and system errors. |

Roles are stored as Firebase Auth **custom claims**, and they are enforced by Security Rules and by the server code. Hiding a button in the UI never counts as security.

## 2. Main features

- **Landing page** with live sections: categories, the latest listings, and live or upcoming auctions. Every number on the page comes from the database. Nothing is invented.
- **Authentication:** register with a role, onboarding (name, phone, location), login, logout, forgot and reset password, email verification, a notice when the session expires, and suspended-account handling.
- **Listings:** create, edit, draft, publish, pause, mark sold out and remove. Up to 6 images can be uploaded, to Vercel Blob on the free plan or to Cloud Storage on Blaze. Units are kg, quintal and tonne, with a normalised price per quintal so listings can be compared.
- **Stock management:** every listing tracks four buckets, `available`, `reserved` (held for auctions), `committed` (owed to agreements) and `sold`. Every movement is recorded in `stockAllocations` and in the audit log.
- **Search and filters:** keyword (name prefix), category, state, district, price range, minimum quantity, quality grade, harvest date and verified farmers, sorted by newest or price.
- **Farmer profiles:** public profile, verification badge and the farmer's listings. Buyers can save farmers.
- **Real-time chat:** one conversation per buyer, farmer and listing. Messages are sent through the server and arrive in real time. Includes unread counts, read markers, retry when a send fails (without duplicates), block and archive, and reporting.
- **Structured offers:** quantity, price per unit, terms and an expiry. A counteroffer creates a new linked offer. States are pending, countered, accepted, rejected, withdrawn, expired and cancelled. Acceptance is atomic: it commits stock and records the agreement in the same transaction.
- **Auctions:** draft, scheduled, live, ended and cancelled. The server clock decides timing. Each auction has a starting price, a minimum increment and an optional reserve. Bids can be public with anonymous labels ("Bidder 1") or sealed. The bid history is anonymised. Results are finalised automatically.
- **Agreements:** created from an accepted offer or an auction win. Contact details are revealed only to the two parties, and each reveal is audited. Progress is tracked as contact initiated, in progress, completed (both parties must confirm), not completed, or disputed.
- **Notifications:** in-app and persistent, with deduplication, a bell counter, and mark read or mark all read.
- **Dashboards:** farmer, buyer and administrator overviews built from real counts.
- **Admin tools:** users, verification, listings, reports, auctions and bids (with buyer identities), agreements, categories, audit log, and system errors.

## 3. Architecture

```
Browser (Next.js App Router, React 19)
 ├─ reads public and own data straight from Firestore (real-time listeners), limited by Security Rules
 ├─ writes only harmless data directly: read markers, notification read state, saved items, bio
 └─ every trusted operation goes through call("<name>", data) with the user's Firebase ID token
        createProduct · sendMessage · respondToOffer · placeBid · createAuction · admin* · …
              │
              ▼  free plan (default)                        Blaze plan (optional)
   Next.js route /api/rpc/<name> on Vercel         callable Cloud Function <name>
              └──────────────┬─────────────────────────────────┘
                             ▼
server/ (one implementation, Firebase Admin SDK)
 ├─ verify the ID token, load the caller, check role and account status
 ├─ validate input with the same Zod schemas as the UI (shared/)
 ├─ apply domain rules (shared/auction.ts, shared/offer.ts, shared/stock.ts)
 ├─ run Firestore transactions for anything touching stock, offers, bids, results or messages
 ├─ write the audit log in the same transaction
 └─ send notifications after the commit (best effort; failures go to opsErrors)

Timers (start/finalise auctions, expire offers): runScheduledWork() in server/index.ts
 ├─ free plan: /api/cron/tick, called by cron-job.org with CRON_SECRET, plus a throttled
 │             background catch-up after normal API requests (at most once a minute)
 ├─ Blaze:     scheduled functions auctionScheduler (1 min) and expireOffers (5 min)
 └─ any plan:  the auction page requests finalisation as soon as the end time passes
```

The key design choices:

- **Money is integer paise** (₹2,150.00 is stored as `215000`). Quantities are whole numbers in the listing's unit.
- **One rule implementation.** `shared/` holds the domain logic, which runs on the server and in the UI. The server is authoritative, and the UI uses the same code only to give early feedback.
- **Idempotency through deterministic document IDs:**
  - Bid IDs combine the auction, the buyer and a client idempotency key.
  - Agreement IDs are `offer_<offerId>` or `auction_<auctionId>`.
  - Allocation IDs are `alloc_offer_<id>` or `alloc_auction_<id>`.
  - Notification IDs are built from the type, an event key and the recipient.
- **The public auction document never holds buyer IDs.** The leader, the reserve price and the winner live in `auctions/{id}/private/state`, which only the farmer and administrators can read.

## 4. Technology stack

| Area | Choice |
|---|---|
| Web | Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript (strict) |
| UI | Tailwind CSS 4, shadcn-style components on Radix primitives, Lucide icons |
| Forms | React Hook Form and Zod 4 (schemas shared with the server) |
| Backend | Firebase Auth and Cloud Firestore (Spark), server code in `server/` run by Next.js API routes on Vercel (free) or by Cloud Functions v2 (Blaze), Vercel Blob or Cloud Storage for photos, App Check (optional) |
| Tests | Vitest (unit, rules, emulator integration), @firebase/rules-unit-testing, Playwright |
| Tooling | ESLint, Prettier, esbuild (functions bundle), tsx (scripts) |

## 5. Folder structure

```
farmconnect/
├─ src/
│  ├─ app/
│  │  ├─ (site)/        public pages: landing, marketplace, products/[id], farmers/[id], auctions, help, terms, privacy, contact
│  │  ├─ (auth)/        login, register, forgot-password, auth/action, onboarding
│  │  └─ (dashboard)/   farmer/*, buyer/*, admin/*, messages, agreements, notifications, settings
│  ├─ components/       ui primitives, layout, auth, marketplace, products, chat, offers, auctions, admin, dashboard
│  │  └─ api/           rpc/[name] (trusted operations), cron/tick (timers), uploads (photo upload tokens)
│  └─ lib/              firebase client and call() wrapper, data hooks and queries, formatting, server clock, server auth
├─ shared/              domain code used by the UI and the server: types, schemas, money, units, stock, offer, auction, agreement
├─ server/              trusted server code: users, products, conversations, offers, auctions, agreements, reports, admin
├─ functions/src/       Cloud Functions adapter for server/ (Blaze plan only)
├─ scripts/             seed-emulator.ts, local-scheduler.ts, grant-admin.ts
├─ tests/
│  ├─ unit/             pure domain logic
│  ├─ rules/            Firestore and Storage security rules
│  ├─ emulator/         server operations end to end against the emulators (through the API route or Cloud Functions)
│  └─ e2e/              Playwright scenarios
├─ firestore.rules · storage.rules · firestore.indexes.json · firebase.json
└─ .env.example · .env.development · vercel.json · DEPLOY-FREE.md
```

## 6. Prerequisites

- Node.js 22 and npm.
- Java 21 or newer, needed by the Firestore and Storage emulators.
- The Firebase CLI. It is installed locally as a dev dependency, so `npx firebase` works.
- For deployment: a Firebase project on the free **Spark** plan and a free Vercel account (see [DEPLOY-FREE.md](DEPLOY-FREE.md)). Blaze is optional.

## 7. Installation

```bash
npm install
npm --prefix functions install   # only needed for the Cloud Functions (Blaze) path and its tests
```

## 8. Environment configuration

| File | Purpose | Committed |
|---|---|---|
| `.env.development` | Points the app and its API routes at the emulators (`demo-farmconnect` project). Used by `npm run dev`. | yes (no secrets) |
| `.env.example` | Template for a real project: public web config, backend and photo-storage mode, and the server-only secrets. Copy the values into Vercel's environment settings. | yes |
| `functions/.env.example` | Cloud Functions settings, Blaze path only (`AUCTION_MIN_DURATION_MINUTES`, `ENFORCE_APP_CHECK`). | yes |
| `functions/.env.local` | Emulator-only override for the functions emulator: 1-minute minimum auction duration. | yes |

All `NEXT_PUBLIC_*` values are public. They identify the project and are safe to ship to browsers.

Three values are **server-only secrets**. Set them in Vercel's project settings, never with a `NEXT_PUBLIC_` prefix, and never commit them:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: the Admin SDK key used by the API routes.
- `CRON_SECRET`: protects `/api/cron/tick`.
- `BLOB_READ_WRITE_TOKEN`: added by Vercel when you connect a Blob store.

They are read only in `server/` and `src/app/api/`. They are never logged and never returned to a client.

## 9. Firebase setup

The free setup is described step by step in [DEPLOY-FREE.md](DEPLOY-FREE.md). In short:

1. On the Spark plan, enable **Authentication** with the **Email/Password** provider.
2. Create a **Cloud Firestore** database in production mode, in `asia-south1` (Mumbai).
3. Register a **Web app** and copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables.
4. Deploy the rules and indexes: `npx firebase use --add`, then `npx firebase deploy --only firestore:rules,firestore:indexes`.
5. Generate a service-account key (Project settings → Service accounts) for `FIREBASE_SERVICE_ACCOUNT_KEY`.
6. Grant the first administrator with `scripts/grant-admin.ts`, then create categories at `/admin/categories`. `npm run seed` refuses to run against a real project on purpose.
7. Optional: **App Check**. A free reCAPTCHA v3 key (`NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY`) or a reCAPTCHA Enterprise key works. Once tokens are arriving, set `ENFORCE_APP_CHECK=true` on the server.

## 10. Authentication configuration

- Email and password sign-in. A verification email is sent at registration and can be re-sent from Settings. In this version, verification is **not** required before trading.
- After registration, the `completeRegistration` operation sets the `role` claim (`farmer` or `buyer`) and creates the profile and the private contact document. A role can only be set once. The `admin` role can only be granted with `scripts/grant-admin.ts`.
- The client refreshes the ID token after onboarding so the new claim takes effect at once.
- Password reset and email action links are handled at `/auth/action`. In Firebase Console → Authentication → Templates, set the action URL to `https://<your-domain>/auth/action`.
- Add your production domain under Authentication → Settings → **Authorized domains**.
- Suspended accounts can still sign in and read their own records, but every trusted operation (including sending chat messages) rejects their actions. The UI shows a banner.

## 11. Firestore schema

These are the main collections. Field-level types are in `shared/types.ts`.

| Collection | Contents | Who can read |
|---|---|---|
| `users/{uid}` | display name, role, location, organisation, bio, verification and account status | farmer profiles: everyone. buyer profiles: self and admins |
| `users/{uid}/private/contact` | email, phone, WhatsApp flag, notification preferences | self and admins (shared to counterparties through `getAgreementContacts`) |
| `users/{uid}/savedProducts`, `savedFarmers` | bookmarks | self |
| `categories/{id}` | name, examples, sort order, active | everyone |
| `products/{id}` | listing, price (paise), unit, normalised price per quintal, stock buckets, search keywords, status, moderation status | active, paused and sold-out listings: everyone. drafts and removed: owner and admins |
| `conversations/{id}` and `/messages/{id}` | participants, preview, unread counts, read markers, status; immutable messages | participants and admins |
| `offers/{id}` | negotiation round: proposer, respondent, quantity, price, terms, expiry, status, links to the parent and superseding offer | buyer, farmer and admins |
| `auctions/{id}` | public auction data; anonymous labels only | everyone (except drafts) |
| `auctions/{id}/private/state` | reserve price, leader, highest amount, winner, allocation | farmer and admins |
| `auctions/{id}/participants/{buyerId}` | anonymous label, own highest bid, `won` | that buyer, farmer and admins |
| `auctions/{id}/publicBids/{bidId}` | anonymised history | everyone (sealed: only after the end) |
| `bids/{id}` | immutable accepted bid with buyer id and idempotency key | that buyer, farmer and admins |
| `stockAllocations/{id}` | reserved, committed, released or fulfilled quantity, with history | farmer and admins |
| `agreements/{id}` | agreed terms, participants, status history, completion confirmations | the two parties and admins |
| `notifications/{id}` | recipient, type, title, message, link, `readAt` | recipient |
| `reports`, `verificationRequests` | user reports and verification requests | reporter or requester, and admins |
| `auditLogs`, `opsErrors` | append-only audit trail, background failures | admins |

## 12. Security rules

`firestore.rules` and `storage.rules` deny by default. Clients may write only:

- their own unread counter and read time on a conversation.
- `readAt` on their own notifications.
- their own saved listings and farmers (buyers only, strict shape).
- `bio` and `profileImage` on their own profile.
- product images under `products/{theirUid}/…` (farmers only; JPEG, PNG or WebP; under 5 MB). On Cloud Storage the Storage rules enforce this. On Vercel Blob, `/api/uploads` enforces the same limits before it issues a short-lived upload token.

Everything else is written only by the server code through the Admin SDK: listings, stock, offers, auctions, bids, allocations, agreements, notifications, reports, categories, audit logs and **chat messages**.

`sendMessage` checks that the sender is a participant, that the conversation is open and that the account is active. It writes the message, preview and unread counts in one transaction. The message ID is chosen by the client, so a retried send cannot duplicate a message.

When a listing is saved, the server also checks that every image is in the farmer's own folder and that its URL points to that same file on Vercel Blob or Cloud Storage. `tests/rules/firestore.rules.test.ts` checks the rules, including Scenario C.

## 13. Required indexes

`firestore.indexes.json` lists every composite index used by the app's queries (37 composite indexes plus a collection-group override for `savedFarmers.farmerId`). Deploy them with:

```bash
npx firebase deploy --only firestore:indexes
```

Indexes take a few minutes to build. Until they are ready, queries that need them fail with a "requires an index" error. The emulator does not enforce indexes, so check this after the first deploy.

## 14. Server code and the two backends

- All trusted logic is in `server/`. `callable(name, schema, handler)` registers an operation. It authenticates the caller from the verified ID token, then validates input with the shared Zod schema and maps errors to safe messages (`server/lib/callable.ts`).
- **Free plan (default):** `src/app/api/rpc/[name]/route.ts` runs every operation on Vercel. It verifies `Authorization: Bearer <Firebase ID token>`, checking for revoked tokens, and optionally App Check. Errors come back as `{ error: { code, message, details } }` with a matching HTTP status. `src/app/api/cron/tick/route.ts` runs the timers when called with `CRON_SECRET`.
- **Blaze (optional):** `functions/src/index.ts` exposes the same operations as callable Cloud Functions in `asia-south1`, plus the scheduled functions `auctionScheduler` (every minute) and `expireOffers` (every 5 minutes). Build with `npm run functions:build`, deploy with `npx firebase deploy --only functions`, and set `NEXT_PUBLIC_BACKEND_MODE=functions`.
- Operations: `completeRegistration`, `updateProfile`, `requestVerification`, `getServerTime`, `createProduct`, `updateProduct`, `setProductStatus`, `updateStock`, `startConversation`, `setConversationState`, `sendMessage`, `createOffer`, `respondToOffer`, `createAuction`, `updateAuctionDraft`, `publishAuction`, `cancelAuction`, `placeBid`, `requestAuctionFinalization`, `updateAgreementStatus`, `getAgreementContacts`, `createReport`, and the admin operations `adminSetAccountStatus`, `adminReviewVerification`, `adminModerateProduct`, `adminResolveReport`, `adminUpsertCategory`, `adminResolveAgreement`, `adminResolveError`, `adminCancelAuction` and `adminGetAuctionBids`.

## 15. Local development

```bash
# terminal 1: emulators (auth, firestore, storage, UI at http://127.0.0.1:4000)
npm run emulators            # imports and exports .emulator-data between runs; use emulators:fresh for a clean start

# terminal 2: seed demo data (categories plus four demo accounts; no fake listings or activity)
npm run seed

# terminal 3: the web app and its API routes at http://localhost:3000
npm run dev
```

**Demo accounts** (emulator only, password `farmconnect-demo`): `admin@example.com`, `farmer@example.com`, `buyer@example.com`, `buyer2@example.com`. They are clearly labelled "Demo" and exist only in the emulator.

The API routes reload automatically when you edit `server/` or `shared/`. To try the Cloud Functions path locally instead, run `npm run emulators:functions` and start the app with `NEXT_PUBLIC_BACKEND_MODE=functions`.

> If you work behind an HTTP proxy, unset `HTTPS_PROXY` and `HTTP_PROXY` for the emulator and dev-server processes.

## 16. Emulator usage

- Emulator UI: http://127.0.0.1:4000. It lets you browse data, Auth users and Storage.
- `.env.development` lowers the minimum auction duration to 1 minute for quick testing.
- Timers run without any scheduler while you use the app: API requests trigger a background catch-up at most once a minute, and the auction page requests finalisation when the end time passes. With nobody using the app, `npm run scheduler:local` plays the role of the cron job.
- `npm run seed` and `scripts/local-scheduler.ts` refuse to run unless the emulator environment variables are set.

## 17. Testing

| Command | What it runs | Needs |
|---|---|---|
| `npm run lint` / `npm run typecheck` | ESLint; TypeScript for the app, server and functions adapter | — |
| `npm run test:unit` | 28 unit tests for money, units, stock buckets, offer and auction rules | — |
| `npm run test:emulator` | Starts fresh emulators, then runs 45 tests: 16 for security rules and 29 integration tests through the Cloud Functions adapter | Java |
| `npm run test:emulator:attach` | The same tests against emulators you already have running | running emulators (with functions) |
| `npm run test:emulator:api` | The same 45 tests sent to the Next.js API route (the free-plan backend) | running emulators and `npm run dev` |
| `npm run test:e2e` | 12 Playwright tests in the browser, using the API routes (starts `npm run dev` if needed) | running emulators with the `cereals` category (`npm run seed`) |
| `npm test` | unit + emulator suites | Java |

The required scenarios are covered as follows:

| Scenario | Where it is tested |
|---|---|
| A: list, discover, chat, offer, counter, accept, stock allocation | `tests/e2e/scenario-a.spec.ts` (browser), `tests/emulator/offers.test.ts` and `chat.test.ts` (server) |
| B: auction, multiple bidders, live updates, end, result | `tests/e2e/scenario-b.spec.ts`, `tests/emulator/auctions.test.ts` |
| C: another buyer's chat or direct auction manipulation is denied | `tests/rules/firestore.rules.test.ts` |
| D: simultaneous bids stay consistent | `tests/emulator/auctions.test.ts` (same-amount race: exactly one accepted; increasing race: consistent highest) |
| E: the same stock cannot go to an auction and an offer | `tests/emulator/offers.test.ts`, `tests/unit/stock.test.ts` |
| F: an auction ends with nobody online and is still finalised | `tests/emulator/scheduler.test.ts` (runs the scheduler code directly) |

These also cover idempotent message and bid retries, image-link validation, finalisation run three times at once, reserve not met, no bids, sealed auctions, double offer acceptance, simultaneous acceptances that would oversell, offer expiry, suspension effects, listing removal, verification, and admin dispute resolution.

## 18. Deployment

**Nothing has been deployed yet.** The free path (Firebase Spark plus Vercel Hobby, no card) is written up step by step in **[DEPLOY-FREE.md](DEPLOY-FREE.md)**:

1. Firebase: Email/Password auth and a Firestore database (`asia-south1`).
2. `npx firebase deploy --only firestore:rules,firestore:indexes`.
3. A service-account key.
4. Vercel: `npx vercel link`, the environment variables, a Blob store, then `npx vercel deploy --prod`. No GitHub is needed.
5. Add the Vercel domain to Firebase Auth's authorised domains, and set the email action URL.
6. cron-job.org calling `/api/cron/tick` with `CRON_SECRET`.
7. Grant the first administrator and create categories.
8. Smoke test.

The Blaze path, with Cloud Functions, scheduled functions and Cloud Storage, is still supported. See the end of DEPLOY-FREE.md.

## 19. Known limitations

- **Search** uses Firestore only. Keyword search matches a single prefix of the product name. State, district, price, quantity, grade and harvest-date filters are applied to each page of results in the browser, after the server filters by status, category and keyword. That is fine for thousands of listings. For larger catalogues or full-text and fuzzy search, add Typesense or Algolia.
- **Chat is text only.** Sending images or files in chat is not implemented.
- **Notifications are in-app only.** There are no emails, SMS or push notifications.
- **Phone numbers are not verified** (no OTP). Email verification is offered but not required.
- **No automatic auction extensions.** The data model already has `originalEndsAt` and `extensionCount`, so anti-sniping can be added later.
- **Timer granularity** depends on the cron interval (5 minutes recommended on the free plan). Results show immediately if anyone has the auction open, because the page requests finalisation, and any API request triggers a catch-up at most once a minute.
- **Free-plan quotas:** Firestore Spark allows 50,000 reads and 20,000 writes per day. See DEPLOY-FREE.md for what uses them.
- **Photos on Vercel Blob are not deleted** when removed from a listing. Unused files are harmless and cannot be attached to someone else's listing.
- **Sealed auctions:** the farmer can see the current highest amount during the auction. Buyers cannot.
- Finalisation reads all participants of an auction in one transaction. That is fine for hundreds of bidders, but very large auctions would need batching.
- **Admin contact lookup:** administrators can read users' private contact documents. Those reads are not audited. Reveals to trade counterparties are audited.
- **Suspension** blocks every action on the server, but it does not revoke existing sessions.
- **Not deployed**, and no production data. Index builds, App Check, email templates, Vercel Blob uploads and the service-account setup have not been checked against real accounts. Vercel Blob uploads are the one piece the local tests cannot exercise, because they need a real Blob store.

## 20. Future enhancements

- External search (Typesense or Algolia) with full-text search, typo tolerance and geo radius.
- Email, SMS or WhatsApp notifications using the existing notification preferences.
- Phone OTP verification and document upload for farmer verification.
- Image sharing in chat.
- Optional auction time extensions (anti-sniping), using the fields already in the model.
- Ratings and reviews after completed agreements.
- Market price references (for example, Agmarknet mandi prices) shown next to listings.
- Optional logistics and payment partners. These are deliberately out of scope for this release.
- Hindi and Telugu translations.

## 21. Business rules

### Offers

- Only buyers start negotiations, and only on an active listing, for no more than the quantity available at that moment.
- A conversation has at most **one pending offer** at a time.
- Expiry options are 6, 24, 48, 72 or 168 hours, or no expiry. An expired offer cannot be accepted. A scheduled job marks it `expired`, and acceptance also checks the expiry.
- Only the **respondent** can accept, reject or counter. Only the **proposer** can withdraw.
- A counteroffer marks the previous round `countered` (with `supersededBy`) and creates a new pending offer for the other party. There is a limit of 20 rounds.
- **Acceptance** runs in one transaction. It re-checks the status, expiry and listing state, moves the quantity from `available` to `committed` (it fails if not enough is available), creates the allocation and the agreement, and posts a system message. Accepting again returns the same agreement.
- Removing a listing cancels its pending offers.

### Auction timing

- Every time comes from the **server clock**. The browser shows a countdown adjusted to the server time, but it never decides when bidding is allowed.
- The minimum duration is 15 minutes (configurable), the maximum is 14 days, and an auction can be scheduled up to 60 days ahead.
- Phases: `draft` → `scheduled` (before the start) → `live` (from start to end) → `ended` or `cancelled`. Between the end time and finalisation, the UI shows "Closed, result pending", and the server refuses bids.
- There are no automatic extensions in this version.

### Bid validation (server)

A bid is accepted only if all of these hold:

1. The bidder is a buyer, the account is active, and it is not the bidder's own auction.
2. The auction is live by server time.
3. The amount is a whole number of paise.
4. It is at least the minimum next bid, which is the starting price for the first bid, or the current highest bid plus the minimum increment. For example, with a highest bid of ₹2,150 and an increment of ₹50, the next bid must be at least ₹2,200. In sealed auctions, the minimum applies to the buyer's own previous bid.
5. The current leader cannot outbid themselves (public auctions).
6. The bid is at most 10× the starting price, which catches typing mistakes.

Bids are processed in a Firestore transaction on the auction document, so two simultaneous bids are applied one after the other. The second one is re-checked against the new highest bid. Each request carries an idempotency key, so a retry after a network error returns the original result instead of placing a second bid. Accepted bids are immutable.

### Stock allocation

- `available + reserved + committed + sold` is the stock of a listing. Only `available` can be offered, auctioned or edited by the farmer.
- Publishing an auction moves its quantity from `available` to `reserved`.
- Winning an auction moves `reserved` to `committed`. No winner, or cancellation, moves `reserved` back to `available`.
- Accepting an offer moves `available` to `committed`.
- An agreement marked completed (both parties confirm, or an admin decides) moves `committed` to `sold`. Marked not completed, it moves `committed` back to `available`.
- Every change is recorded in `stockAllocations` (with history) and in `auditLogs`. A listing with reserved or committed stock cannot be removed, and its unit cannot be changed.

### Cancellation

- A farmer can cancel an auction only **before the first bid**, and must give a reason.
- After bidding starts, only an **administrator** can cancel it, with a reason that is shown to bidders and recorded in the audit log.
- Cancellation releases the reserved stock and notifies the bidders.
- Suspending a farmer pauses their active listings and cancels their auctions that have no bids. Auctions that already have bids are left for an administrator to decide.

### Winner determination

At or after the end time, finalisation (by the timer, a background catch-up or a viewer's request) runs once, in a transaction:

- **No bids** → `no_bids`, and the stock is released.
- **Highest bid below the reserve** → `reserve_not_met`, and the stock is released.
- Otherwise the **highest valid bid wins**. Since a bid must exceed the previous highest by at least the increment, ties cannot happen in public auctions. In sealed auctions, an equal amount does not displace the earlier bid, so the earliest highest bid wins.
- With a winner, the reserved quantity is committed, an agreement is recorded at the winning price, a conversation between the farmer and the winner is opened, and both are notified.
- A finalised auction is never changed again, so repeated or overlapping runs are safe.
