# FarmConnect

### Connecting farmers and buyers through direct agricultural trading

FarmConnect is an agricultural marketplace where farmers publish produce and buyers discover listings, communicate with growers, negotiate prices, and participate in auctions.

The application brings produce listings, conversations, offers, bids, stock records, and trade agreements into one platform.

**Course:** Full Stack Development–1  
**Team size:** 5 members  
**Frontend:** React, Next.js, TypeScript, Tailwind CSS, and custom CSS

> **Current status:** The project is configured for local development using the Firebase Emulator Suite. It has not been deployed. The merged repository includes the restored application source files, but a successful production build and complete runtime validation of that version have not yet been recorded.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Proposed Solution](#proposed-solution)
4. [Project Objectives](#project-objectives)
5. [Team Members](#team-members)
6. [Features and User Roles](#features-and-user-roles)
7. [Technology Stack](#technology-stack)
8. [Architecture](#architecture)
9. [Folder Structure](#folder-structure)
10. [Local Setup](#local-setup)
11. [Demo Accounts](#demo-accounts)
12. [Demonstration Flow](#demonstration-flow)
13. [Validation and Testing](#validation-and-testing)
14. [Environment Configuration](#environment-configuration)
15. [Security and Data Handling](#security-and-data-handling)
16. [Team Git Workflow](#team-git-workflow)
17. [Known Limitations](#known-limitations)
18. [Future Improvements](#future-improvements)
19. [Photography and Credits](#photography-and-credits)

---

## Project Overview

FarmConnect supports direct communication between farmers and agricultural produce buyers.

Farmers can manage listings and stock, respond to offers, and create auctions. Buyers can browse produce, save listings, negotiate with farmers, place bids, and track agreements.

The frontend includes:

- A photographic landing page with an automatic slideshow.
- Crop category navigation.
- Search and filtering interfaces.
- Product and farmer detail pages.
- Separate farmer and buyer dashboards.
- Listing and auction forms.
- Messaging and structured offer interfaces.
- Loading, error, and empty states.
- Responsive layouts and accessible motion preferences.

The project uses **Next.js, which is built on React**. It includes Firebase and server-side business logic for authentication, persistence, and trusted operations. It is therefore a full-stack application rather than a frontend-only prototype.

### Scope Boundary

FarmConnect records agreed trade terms, but the farmer and buyer arrange inspection, payment, transport, and delivery directly.

The application does not process payments, hold money in escrow, or provide logistics services.

---

## Problem Statement

Farmers and buyers often coordinate produce trading through separate calls, messages, and informal records.

This can make it difficult to:

- Present available produce consistently.
- Compare quantity, quality, location, and asking price.
- Track offers and counteroffers.
- Distinguish available stock from reserved or committed stock.
- Maintain a shared record of agreed terms.

FarmConnect addresses this coordination problem by providing a common interface for produce discovery, negotiation, bidding, and agreement tracking.

---

## Proposed Solution

FarmConnect provides the following workflow:

1. A farmer publishes a produce listing.
2. A buyer searches the marketplace and examines the listing.
3. The buyer contacts the farmer and sends a structured offer.
4. The farmer accepts, rejects, or counters the offer.
5. An accepted offer creates an agreement and updates the stock allocation.

As an alternative trading method:

1. The farmer reserves stock for an auction.
2. Buyers submit bids during the auction period.
3. Server logic validates bids and determines the result.
4. A qualifying winning bid creates an agreement.

Trading records are persisted in Firestore so they can be retrieved after a browser refresh.

---

## Project Objectives

- Build an understandable agricultural marketplace interface.
- Apply React component structure and reusable UI patterns.
- Provide responsive pages for different screen sizes.
- Display data from persistent records.
- Handle loading, empty, error, and invalid-input states.
- Validate trusted operations on the server.
- Demonstrate one complete trading flow.
- Maintain clear team contributions and teammate reviews in Git.

---

## Team Members

| Name | Roll Number | GitHub Account | Contribution Area |
|---|---|---|---|
| Thoka Sanjay Teja | 24BDS083 | [SanjayTeja01](https://github.com/SanjayTeja01) | Project foundation, landing page, styling, photography integration, and repository completion |
| Mudavath Santhosh | 24BDS044 | [mudavathsanthosh912-spec](https://github.com/mudavathsanthosh912-spec) | Buyer dashboard, buyer auctions, bids, offers, and related components |
| G Dharmik | 24BDS021 | [Dharmikgalla](https://github.com/Dharmikgalla) | Marketplace, product details, saved listings, and marketplace components |
| Gade Banu Vardhan Reddy | 24BDS022 | [bhanug2007-prog](https://github.com/bhanug2007-prog) | Farmer dashboard, listing and auction management, and public farmer pages |
| Basireddy Lokeshwara Reddy | 24BDS011 | [Loki6300](https://github.com/Loki6300) | Shared interface, navigation, authentication pages, settings, notifications, agreements, and messaging pages |

Each member is responsible for understanding and explaining the code they submit, including code developed with AI assistance.

---

## Features and User Roles

### Visitor

- View the landing page and crop photography.
- Browse produce categories and marketplace listings.
- View product and farmer details.
- Browse public auction information.
- Read help, contact, privacy, and terms pages.

### Farmer

- View a farmer dashboard.
- Create and manage produce listings.
- Enter price, quantity, unit, location, and crop details.
- Manage listing stock.
- Create and manage auctions.
- Communicate with buyers.
- Respond to offers and counteroffers.
- Track agreements.
- Request account verification.

### Buyer

- View a buyer dashboard.
- Search and filter marketplace listings.
- View product and farmer details.
- Save listings.
- Communicate with farmers.
- Submit offers and counteroffers.
- Participate in auctions.
- View bid history and agreements.

### Administrator

- Manage users and verification requests.
- Moderate listings.
- Review reports.
- Manage categories.
- Inspect auctions and agreements.
- View audit records and operational errors.

### UI and Interaction

- Automatic hero slideshow with navigation and pause controls.
- Scroll-triggered section reveals.
- CSS perspective and hover effects.
- Glass-style cards and interface panels.
- Responsive layouts.
- Form validation and submission feedback.
- Reduced-motion support.

These features are implemented in the source. Their presence does not mean that every interaction has passed runtime testing.

---

## Technology Stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | React 19 and Next.js 16 | Components, routing, layouts, and pages |
| Language | TypeScript | Typed application logic |
| Styling | Tailwind CSS 4 and custom CSS | Responsive layouts, styling, and animation |
| UI primitives | Radix UI | Interactive interface components |
| Icons | Lucide React | Interface icons |
| Forms | React Hook Form | Form state and input handling |
| Validation | Zod | Input schemas and validation |
| Authentication | Firebase Authentication | Accounts, sign-in, and role claims |
| Database | Cloud Firestore | Persistent application records |
| Server | Next.js API routes and Firebase Admin SDK | Trusted operations and data changes |
| Optional server adapter | Firebase Cloud Functions | Alternative transport for shared server logic |
| Local services | Firebase Emulator Suite | Local authentication, database, and storage |
| Testing | Vitest and Playwright | Unit, integration, and browser tests |
| Code checks | TypeScript and ESLint | Type checking and linting |

---

## Architecture

```text
React interface
    |
    +-- Firebase Authentication
    |      Sign-in and ID tokens
    |
    +-- Firestore listeners
    |      Public and permitted user records
    |
    +-- Authenticated requests to /api/rpc/<operation>
           |
           +-- Server authorization and validation
           +-- Business rules
           +-- Firestore transactions
           +-- Stock and agreement updates
```

### Frontend

The interface is organized into pages, reusable components, forms, and feature-specific components.

### Server

Trusted operations such as publishing listings, accepting offers, and placing bids go through server logic.

### Shared Logic

The `shared/` directory contains types, schemas, and helpers used by both frontend and server code.

### Backend Transport

The default backend uses Next.js API routes.

The `functions/` directory provides an optional Cloud Functions adapter. The standard local setup below uses API routes and does not require the Functions emulator.

---

## Folder Structure

```text
Full-Stack-Development/
├── public/
│   └── images/              Photography and credits
├── src/
│   ├── app/
│   │   ├── (site)/          Public pages
│   │   ├── (auth)/          Authentication and onboarding
│   │   ├── (dashboard)/     Farmer, buyer, and admin pages
│   │   ├── api/             Server endpoints
│   │   ├── layout.tsx       Root layout and providers
│   │   └── globals.css      Shared styles and motion
│   ├── components/
│   │   ├── auth/
│   │   ├── auctions/
│   │   ├── chat/
│   │   ├── dashboard/
│   │   ├── forms/
│   │   ├── landing/
│   │   ├── layout/
│   │   ├── marketplace/
│   │   ├── offers/
│   │   ├── products/
│   │   └── ui/
│   └── lib/                 Firebase, data access, hooks, and utilities
├── server/                  Trusted business operations
├── shared/                  Types, schemas, and domain helpers
├── functions/               Optional Cloud Functions adapter
├── scripts/                 Emulator, seed, and scheduler scripts
├── tests/
│   ├── unit/
│   ├── emulator/
│   ├── rules/
│   └── e2e/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── next.config.ts
├── package.json
└── README.md
```

Next.js route-group folders such as `(site)` organize the source without adding their names to the URL.

---

## Local Setup

### Prerequisites

Install:

- Git.
- Node.js 22 and npm.
- Java 21 or newer for the project's emulator setup.
- A browser.

Internet access is needed for the initial dependency installation and emulator downloads.

Check the tools:

```bash
git --version
node --version
npm --version
java -version
```

### 1. Clone the Repository

```bash
git clone https://github.com/SanjayTeja01/Full-Stack-Development.git
cd Full-Stack-Development
git switch main
```

### 2. Install Dependencies

```bash
npm ci
```

The Firebase CLI is included as a development dependency and can be invoked with `npx firebase`.

### 3. Use the Local Emulator Configuration

The committed `.env.development` points development mode at the local `demo-farmconnect` project.

`emulators.env` contains the addresses used by the seed and scheduler scripts.

No real Firebase service-account key is required for this local workflow.

Do not replace `.env.development` with `.env.example`; the example describes configuration for a real Firebase project.

### 4. Start the Emulators — Terminal 1

From the repository root:

```bash
npm run emulators
```

Wait until the emulators report that they are ready. Keep this terminal open.

### 5. Seed Categories and Demo Accounts — Terminal 2

Open another terminal at the repository root:

```bash
npm run seed
```

The seed script creates crop categories and clearly labeled demo accounts.

It does not create listings, bids, or completed trades. Create those through the application.

### 6. Start the Website — Terminal 2

```bash
npm run dev
```

Open the address printed by Next.js, normally:

```text
http://localhost:3000
```

If that port is occupied, Next.js may use another port. Use the URL printed in the terminal.

### 7. Start the Local Scheduler — Terminal 3

For auction and offer expiry demonstrations:

```bash
npm run scheduler:local
```

To process due work once:

```bash
npm run scheduler:local -- --once
```

### Local Service Addresses

| Service | Address |
|---|---|
| Website | URL printed by Next.js, normally `http://localhost:3000` |
| Emulator UI | `http://127.0.0.1:4000` |
| Authentication emulator | `127.0.0.1:9099` |
| Firestore emulator | `127.0.0.1:8080` |
| Storage emulator | `127.0.0.1:9199` |

### Data Persistence

Application records remain available after browser refresh while the emulators are running.

The emulator startup script imports a previous `.emulator-data` export when available and exports data on normal shutdown.

Stop the emulator terminal using `Ctrl+C` and wait for export to finish. Avoid starting with `emulators:fresh` when you want to preserve an existing local dataset.

### Common Setup Issues

| Issue | What to check |
|---|---|
| Login or data requests fail | Confirm the emulators are running and the development environment is loaded. |
| Categories are missing | Run `npm run seed` after emulator startup. |
| Website opens on a different port | Use the address printed by Next.js. |
| Auctions do not finalize during a demo | Start the local scheduler or run it once. |
| Java error during emulator startup | Confirm Java is installed and available in the terminal. |
| Browser tests target the wrong port | The Playwright setup uses port `3000` by default. |

---

## Demo Accounts

These accounts are created by `npm run seed` in the local emulator environment.

| Role | Email | Password |
|---|---|---|
| Farmer | `farmer@example.com` | `farmconnect-demo` |
| Buyer | `buyer@example.com` | `farmconnect-demo` |
| Second buyer | `buyer2@example.com` | `farmconnect-demo` |
| Administrator | `admin@example.com` | `farmconnect-demo` |

These credentials are for local demonstrations only. Do not use the shared password for real accounts.

---

## Demonstration Flow

Use two separate browser profiles or a normal and private window to keep farmer and buyer sessions separate.

1. Sign in as the demo farmer.
2. Publish a listing with crop details, quantity, unit, location, and price.
3. Sign in as the demo buyer in the other browser session.
4. Find the listing in the marketplace.
5. Open the product and start a conversation.
6. Send a structured offer.
7. As the farmer, accept the offer or submit a counteroffer.
8. Accept the final offer and open the agreement.
9. Refresh the agreement page to demonstrate persistence.
10. Check the farmer's stock records to demonstrate the allocation change.

Rehearse this complete flow before evaluation. Test files describing a flow do not establish that the current version has passed it.

---

## Validation and Testing

### Recorded Validation

| Check | Status |
|---|---|
| Source inventory at commit `502ac26` | 128 files present under `src/`; omitted supporting files restored |
| Internal import inspection at that commit | 796 internal imports inspected with no missing target files found |
| Unit tests on the original local working project | 28 tests passed |
| TypeScript on the original local working project | Passed during local checks |
| Production build of the merged GitHub version | Not yet recorded |
| Complete runtime flow on the merged GitHub version | Not yet recorded |
| GitHub Actions | No workflow configured at the time of repository inspection |

The static import check only verifies that internal target files exist. It does not verify types, runtime behavior, or production build success.

The local test results above apply to the original working project and must not be presented as fresh-clone validation of the merged repository.

### Lint

```bash
npm run lint
```

### Unit Tests

```bash
npm run test:unit
```

### Main Application Type Check

```bash
npx tsc --noEmit
```

### Production Build Check

```bash
npm run build
```

### Combined Application and Functions Type Check

Install the Functions dependencies first:

```bash
npm --prefix functions ci
npm run typecheck
```

### Browser Tests

Start the emulators and run the seed script first. Then install Chromium and run the tests:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration can start a development server at port `3000`. Ensure that the emulator suite is already running.

### Emulator Integration Tests

These tests require Functions dependencies and start their own emulator suite:

```bash
npm --prefix functions ci
npm run test:emulator
```

Stop an existing emulator suite before this command to avoid port conflicts.

---

## Environment Configuration

| File | Purpose |
|---|---|
| `.env.development` | Local development configuration using Firebase emulators |
| `.env.example` | Configuration template for a real Firebase project |
| `emulators.env` | Emulator addresses for seed and scheduler scripts |
| `functions/.env.local` | Local Functions emulator settings |
| `functions/.env.example` | Functions configuration template |

The tracked development environment files contain local emulator settings. They must not be used to store real production credentials.

Deployment requires configuring a real Firebase project, authorized domains, rules, indexes, server credentials, photo storage, and scheduling.

The application has not been deployed or validated against a production Firebase project.

---

## Security and Data Handling

- Firebase Authentication provides account identity.
- Role claims distinguish farmer, buyer, and administrator access.
- Firestore rules restrict direct client reads and writes.
- Trusted operations perform server-side authorization and schema validation.
- Stock and trade changes use server business rules and transactions.
- Contact details are accessed through the agreement workflow according to the application's access rules.

Do not commit:

- Real Firebase service-account keys.
- Private keys.
- Passwords or production credentials.
- `FIREBASE_SERVICE_ACCOUNT_KEY` values.
- `CRON_SECRET` values.
- `BLOB_READ_WRITE_TOKEN` values.
- Dependency folders such as `node_modules`.
- Generated build output such as `.next`.
- Local emulator exports.

`.gitignore` excludes common generated and private files, but it does not remove files already tracked by Git.

---

## Team Git Workflow

The integration branch is `main`.

The following contribution pull requests were merged:

| Pull Request | Contribution |
|---|---|
| [PR #1](https://github.com/SanjayTeja01/Full-Stack-Development/pull/1) | Marketplace, product details, and saved listings |
| [PR #2](https://github.com/SanjayTeja01/Full-Stack-Development/pull/2) | Farmer dashboard and management pages |
| [PR #3](https://github.com/SanjayTeja01/Full-Stack-Development/pull/3) | Buyer dashboard and bidding interface |
| [PR #4](https://github.com/SanjayTeja01/Full-Stack-Development/pull/4) | Shared interface and authentication pages |

The initial foundation and missing-source correction were committed separately.

For future contributions:

1. Update local `main`.
2. Create a feature branch.
3. Make and explain the change.
4. Stage the relevant files.
5. Commit with a descriptive message.
6. Push the branch.
7. Open a pull request.
8. Request another teammate's review.
9. Address feedback and merge after approval.

Review comments and validation claims should describe checks actually performed.

---

## Known Limitations

- The merged repository still requires a recorded production build and complete browser-flow validation.
- The demonstration environment depends on local emulators.
- Emulator data is not automatically shared between teammates.
- No online deployment is included.
- Payment processing, escrow, inspection, and transport services are outside the project scope.
- Search uses the current Firestore/query implementation rather than a dedicated full-text search engine.
- Chat is text-based.
- Notifications are in-app; SMS and push notifications are not implemented.
- Phone ownership is not verified through OTP.
- Email verification is available but is not required for trading in this version.
- Auction finalization depends on server operations and scheduling.
- The project includes more backend functionality than a minimal frontend-only coursework application.
- Visual polish and implemented screens do not establish that all business flows have passed testing.

---

## Future Improvements

- Add GitHub Actions for lint, type checking, unit tests, and builds.
- Automate one complete browser trading flow.
- Record fresh-clone setup and refresh-persistence test results.
- Resolve defects found during integrated testing.
- Validate a deployment with a real Firebase project.
- Improve search and accessibility through user testing.
- Refine dashboard interactions and responsive layouts.
- Consider delivery coordination or payment integration only after defining the required business and security rules.

---

## Photography and Credits

The landing page and crop categories use user-supplied photography and selected Unsplash photos.

Optimized assets are served from `public/images/`. Sources and credits are documented in:

[public/images/CREDITS.md](public/images/CREDITS.md)

Editorial photographs represent crops and farm work. They are not photographs of an individual seller's listing.

---

**Repository:** [SanjayTeja01/Full-Stack-Development](https://github.com/SanjayTeja01/Full-Stack-Development)
