# Original FarmConnect project review

Reviewed 5 November 2026. Scope: the original Next.js/Firebase app in this folder, following the user's clarification. This is a source review, not a claim that every feature has passed a live demo. No application code was changed.

## Coverage

Read the project-owned application, backend, domain, test, script, configuration and documentation files. The companion `PROJECT-FILE-INVENTORY.md` lists the files by area. The favicon was inventoried as a binary asset. Dependency lockfiles were inspected as dependency metadata; generated `.next`, installed `node_modules`, TypeScript build metadata and debug output were not treated as authored application source. The remaining `farmconnect-fsd.zip` is a separate implementation archive.

The earlier member packages, UI packages and external React/Express repository are distinct from this original app. Those unpacked packages are no longer present in the current folder snapshot. Their contribution history does not establish the contribution history of this Next.js app. This folder itself has no Git repository.

## How the app connects

1. `src/app/layout.tsx` installs authentication and toast providers. Route groups divide public pages, account pages and protected dashboards.
2. Firebase Auth supplies identity and role claims. `RequireAuth` guides navigation; server checks and Firestore rules enforce access.
3. Public/owned data is read with Firestore listeners in `src/lib/data`. Bookmarks and read markers are limited direct client writes.
4. `src/lib/firebase/callable.ts` sends trusted changes to `/api/rpc/[name]`, or optionally Cloud Functions. Both transports invoke the same operation registry in `server/index.ts`.
5. `server/lib/callable.ts` validates input with shared Zod schemas and loads the actor. Individual operations check role, ownership and domain conditions.
6. `shared` defines money in integer paise, units, schemas, offer/auction states and stock transitions. Stock moves between available, reserved, committed and sold buckets.
7. Offer acceptance and auction finalization create agreements and change stock within Firestore transactions. Agreement completion settles committed stock. Payment and delivery happen outside the app.
8. Notifications are written after the main commit. Audits normally accompany the transaction. Timers run through cron, API catch-up, local scheduler or Cloud Functions schedules.

## Checks actually run

| Check | Observed result |
|---|---|
| `npm run test:unit` | Passed: 28 tests across 4 files |
| `npm run lint` | Passed, exit code 0 |
| `npm run typecheck` | Main `tsc --noEmit` passed; subsequent functions typecheck failed |
| Functions typecheck failure | Missing `firebase-functions/https` and `firebase-functions/scheduler`; `functions/node_modules` does not exist |
| Browser, emulator integration, rules tests, production build | Not run in this review |

The functions failure is an installation/setup limitation in this checkout, not proof that those imports are wrong. The README already documents installing the functions dependencies separately. Dependencies were not installed as part of a read-only code review.

## Findings

These are source-supported findings. Runtime reproduction is still needed where stated.

### 1. Public bid records expose buyer user IDs

`server/auctions.ts:312` creates a bid ID from auction ID, buyer UID and request key. Line 361 copies that ID into both the document path and field under publicly readable `publicBids`. Anyone reading public bid history can therefore recover the UID and link the same account across auctions. Anonymous labels in the UI do not remove this identifier. This does not by itself expose the buyer's private phone or email.

Use an opaque public bid identifier and retain the idempotency mapping privately. The existing privacy assertion in `tests/emulator/auctions.test.ts` checks the parent auction document, but not public bid records or their document IDs.

### 2. Token refresh can leave the auth provider stuck loading

`src/components/auth/auth-provider.tsx:49` sets profile loading on every token event. The profile listener effect depends only on `user` and `role`. A token refresh for the same User object and unchanged role need not restart that effect, so no fresh profile callback is guaranteed to clear loading. `refreshClaims` has the same risk when the role stays unchanged.

Exercise a token refresh after normal sign-in. Keep an already loaded profile usable during a same-user refresh, or explicitly manage the profile load lifecycle.

### 3. Registration cannot recover from a partial backend failure

`server/users.ts` commits the user profile and private contact first, then sets the role claim at line 50. If setting the claim fails, retrying finds the existing profile at line 27 and refuses registration. The browser still lacks a role and returns to onboarding, which cannot finish.

Make retry resume a consistent existing registration using the stored role, without allowing the caller to replace it. Current integration helpers create claims and profiles directly, so they do not test this recovery path.

### 4. Password reset validation removes the form

`src/app/(auth)/auth/action/auth-action.tsx` uses one error state for invalid action links and ordinary form validation. A short password or mismatched confirmation sets that error at lines 72–73. The render then switches from the password form to the invalid-link/error branch, leaving no fields to correct.

Separate action-link errors from editable form errors. Verify short-password and confirmation-mismatch recovery in the browser.

### 5. Several read failures are hidden or leave permanent loading

- Farmer and buyer overview pages pass `ignore` as the error callback to their data subscriptions. Initial failures leave loading placeholders, without a visible error or retry.
- `src/components/dashboard/widgets.tsx:56` converts a notification read failure into an empty activity list.
- `src/components/auctions/auction-form.tsx:174` returns a spinner when products are null before rendering the error set by the failed subscription.
- Settings does not handle rejection of the private-contact read and spins if the document is absent.
- Saved-page reads expose an error from the hook, but the page does not render it; removal actions also lack error feedback.
- Farmer profile and agreement-detail reads can turn a connection/permission failure into an empty/not-found result.

These are directly relevant to the supplied rubric's loading, error, empty-state and honesty requirements. Reproduce with a stopped emulator or denied read, then show a visible error and retry instead of a successful empty state.

### 6. Offer and auction notification switches are not enforced

Settings saves `notificationPreferences.offers` and `.auctions`. Only chat notification delivery reads preferences. Offer and auction operations call the generic `notify` helper, which does not filter preferences. A user can disable those switches and still receive routine new-offer or auction announcements.

Define which events are mandatory, and enforce optional preferences centrally. Preserve the explicitly described mandatory account/result/agreement notices.

### 7. Upload authorization does not enforce account suspension

`src/app/api/uploads/route.ts:17` checks a valid farmer role claim, but does not load the profile or check account status. Suspension changes the Firestore profile rather than revoking the claim, so a suspended farmer can still obtain Blob upload tokens. Storage rules likewise check ownership and role rather than the suspension state.

Listing creation remains blocked by server role/status checks, but uploads are a separate action. Apply the intended account-status policy consistently. Malformed upload JSON also falls outside the route's error handler.

### 8. Published privacy/help text differs from actual behavior

- Privacy says administrators may read conversations only when reported. `firestore.rules:79` and `:91` allow admins to read all conversations/messages without a report condition.
- Help says marketplace cards display normalized price per quintal. Cards display the original price/unit; normalized price appears on the product detail and is used for sorting/filtering.
- Auction terms describe public bidding rules without the sealed-auction exception, although sealed bidders can raise their own bids based on their own prior amount.
- Product location input says it is shown publicly at district level, while detail views and public documents include an optional village.

Align the text and actual access/behavior before presenting these claims to an evaluator.

### 9. The one-open-offer check can select an expired record

`server/offers.ts:50` queries pending offers with `limit(1)`, then permits creation if that one document has expired. It does not mark that expired record resolved in this transaction. Until the scheduler cleans it up, that same expired record can be selected again while another nonexpired pending offer exists, allowing further open offers. Which record is selected depends on document ordering.

Test with an expired pending record ordered before a live pending record. Use a transactional active-offer pointer or resolve/query the candidate set reliably.

## What is already well structured

- Domain logic is shared rather than independently reimplemented in each transport.
- Money uses integer paise and line totals check safe integer limits.
- Stock-changing operations use transactions, with dedicated stock-bucket functions.
- Bids and message retries have idempotency keys; offer acceptance returns its existing agreement on retry.
- Most trusted records are client-read-only under Firestore rules.
- UI primitives provide consistent forms, loading indicators, alerts and confirmation dialogs.
- Tests cover meaningful stock races, bid races, access restrictions and scheduler outcomes at source level.

## Test coverage and remaining verification

The 17 test files comprise 4 domain unit files, 7 emulator files including helpers, 1 security-rules file, and 5 browser files including fixtures. Emulator tests cover offers, auctions, chat, administration, image URL validation and timers. Browser scenarios cover registration, role restrictions, negotiation and bidding; responsive tests check public/account pages at phone width.

Missing targeted coverage includes registration partial failure, same-user token refresh, password-reset correction, public bid identifier privacy, notification preference enforcement and several read-failure screens. Normal mutual agreement completion also deserves a direct integration scenario.

Live emulator/rules/browser tests and a production build remain necessary before describing the original app as fully verified. Production upload configuration and deployed Firestore indexes also remain unverified. No numeric evaluation score is inferred from source alone.

## Evaluation implications

This original app has substantially more code and setup than the classroom React/Express version. The supplied scope slide explicitly names React plus Express and server-file persistence for 15 marks; this Next.js/Firebase implementation should not automatically be assigned that tier without the instructor accepting the alternative stack.

For this original app, explain the complete path from UI to token verification to schema validation to transaction to stock allocation to agreement. Each teammate must understand their actual work. Prioritize a refresh-persistent end-to-end flow and visible failure handling, since code reading and the live demo account for 70 marks together. Extra authentication, database or deployment complexity does not earn extra marks on its own under the supplied screenshots.
