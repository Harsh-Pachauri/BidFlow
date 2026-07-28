# Interview Notes — British Auction RFQ System

Running log of design decisions for the GoComet Full Stack Intern assignment.
Each entry: what we decided, why, alternatives considered, trade-offs, and a
model Q&A for follow-up interviews. Entries are added once a decision is
actually locked, not while it's still being debated.

## Log

### 1. "British Auction" naming vs. actual mechanics
**Decision:** Build to the spec's definition (open, descending-price,
anti-sniping-extension auction), not the textbook definition (English/British
auction = ascending price, open outcry).
**Why:** The PDF explicitly redefines the term for this context (Section 1).
Textbook British auctions ascend in price; this one descends, because it's a
procurement/reverse-auction context, not a sale.
**Interview Q:** "Isn't a British auction ascending-price?"
**A:** "Yes, in classical auction theory. This spec repurposes the name for a
descending-price reverse auction — I built to the spec's explicit definition
and noted the naming inconsistency in the README rather than silently
changing behavior to match the textbook term."

### 2. Database: PostgreSQL over MongoDB
**Decision:** PostgreSQL.
**Why:** The domain is inherently relational (RFQs -> Bids -> Suppliers,
foreign keys, uniqueness/CHECK constraints like `forced_close_at >
bid_close_at`), and the core hard problem — detecting rank changes and
extending time safely when two bids land close together — needs
transactional row-locking (`SELECT ... FOR UPDATE`), which Postgres does
natively and idiomatically.
**Alternative considered:** MongoDB — has supported multi-document
transactions since v4, so it isn't disqualified outright, but modeling FK
constraints, CHECK constraints, and ranking via window functions is more
natural and less code in Postgres.
**Interview Q:** "Why not Mongo for flexibility?"
**A:** "There's no schema-flexibility need here — every entity has a fixed,
known shape — so Mongo's main advantage doesn't apply, while Postgres's
transactional guarantees directly solve the hardest problem in the
assignment: safe concurrent bidding."

### 3. Auth: JWT over server-side sessions
**Decision:** JWT access token (no refresh), issued on login, sent as
`Authorization: Bearer`.
**Why:** Socket.io needs a portable credential at handshake time. A JWT can
be handed to `socket.handshake.auth.token` directly; sharing an
`express-session` cookie store with a separate Socket.io auth check is
comparatively more moving parts for this scope.
**Alternative considered:** `express-session` + `connect-pg-simple`. Simpler
for pure REST, but awkward for the realtime half of this app.
**Trade-off accepted:** JWTs can't be revoked before they expire. Acceptable
because scope is login-only with no refresh token, so exposure is bounded by
a short expiry.
**Interview Q:** "Why JWT instead of sessions if you're not even using
refresh tokens?"
**A:** Socket.io handshake simplicity is the deciding factor, not "JWT is
more modern" — see Why above.

### 4. Token storage: localStorage over httpOnly cookie
**Decision:** Store the JWT in `localStorage`, attach manually via an Axios
interceptor and the Socket.io handshake `auth` payload.
**Why:** httpOnly cookies would need CSRF-token handling to stay safe, which
is disproportionate infrastructure for a login-only, no-refresh-token scope.
localStorage + Bearer is simpler to build, demo, and explain.
**Trade-off accepted:** vulnerable to token theft via XSS. Named explicitly
as a known limitation; production would use httpOnly cookies + CSRF token or
a backend-for-frontend proxy.

### 5. Status semantics: "Closed" vs "Force Closed"
**Decision:** An auction is **Force Closed** if its final `bid_close_at`
(after all extensions) equals `forced_close_at` when it stops accepting
bids. It is **Closed** if it stops accepting bids at a `bid_close_at` that's
still strictly before `forced_close_at` (activity died down before hitting
the ceiling).
**Why:** The PDF names three statuses (Active/Closed/Force Closed) but never
defines the Closed/Force-Closed split explicitly. This is the most literal
reading of "forced close time, after which bidding must stop no matter what"
(Section 1) as the specific trigger for the "Force Closed" label.
**Flagged for confirmation:** this is an inference, not stated outright in
the source doc.

### 6. Extension trigger configuration: single strategy per RFQ
**Decision:** `extension_trigger_type` is a single enum column on `RFQ`
(`ANY_BID` | `ANY_RANK_CHANGE` | `L1_CHANGE_ONLY`), chosen once at creation —
not three independent booleans.
**Why:** The three trigger definitions nest by strictness — every L1 change
is a rank change, and every rank change requires a bid. Enabling more than
one is either redundant (the broader trigger already covers the narrower
one) or meaningless. A single chosen policy avoids the overlap entirely and
keeps the "should this extend?" check a plain switch, not a combinatorial
rule set.
**Interview Q:** "Why not let buyers combine triggers for extra safety?"
**A:** "Any-rank-change" is already a superset of "L1-only" — combining them
can never change behavior, only create the illusion of extra configurability.

### 7. Bid storage: append-only `bids` table
**Decision:** Every bid submission inserts a new row; nothing is ever
updated in place. A supplier's "current" bid on an RFQ is their latest row
by `submitted_at`. Rank is computed from that latest-per-supplier set, not
stored.
**Why:** The §8 activity log requirement comes for free — the bids table
already *is* a timestamped history — and it removes an entire class of bugs
where a "current quote" table and a separate history table could drift out
of sync.
**Interview Q:** "Doesn't storing every bid make querying current state
slower?" **A:** Irrelevant at this scale, and the query is a standard
`DISTINCT ON (supplier_id) ... ORDER BY supplier_id, submitted_at DESC` (or
an equivalent window function) — a well-understood, indexable pattern, not
a performance risk here.

### 8. Data access: Prisma by default, raw SQL carved out for the locking-critical path
**Decision:** Prisma is the client for everything — users, RFQ CRUD, reads
for listing/details. The one exception is the bid-placement transaction,
where correctness matters most: that path uses a Prisma **interactive
transaction** (`prisma.$transaction(async (tx) => {...})`), and inside it,
`tx.$queryRaw` runs `SELECT ... FOR UPDATE` on the target RFQ row before
reading current bids, inserting the new one, and — if a trigger condition is
met — updating `bid_close_at`. Everything else inside that same transaction
still goes through normal Prisma calls (`tx.bid.create(...)`,
`tx.rfq.update(...)`).
**Why:** Prisma's query builder has no first-class syntax for row-level
locking, but its interactive transactions accept raw queries in the same
transaction scope — so we get Prisma's ergonomics everywhere except the one
place a lock is non-negotiable. This directly answers "how did you stop two
suppliers from corrupting auction state by bidding at the same time" with an
inspectable line of code, rather than "the ORM handles it."
**Trade-off named up front:** the raw-SQL function is less type-checked than
the rest of the codebase. Accepted deliberately, and isolated to a single,
clearly-commented function so it doesn't spread.
**Interview Q:** "Why not just wrap the whole thing in a Prisma transaction
without the explicit lock?" **A:** A transaction alone gives atomicity
(all-or-nothing) but not isolation from a concurrent transaction reading the
same row before the first commits. `FOR UPDATE` is what makes the second
transaction *wait* instead of reading stale ranking data.

### 9. Bid visibility: fully open
**Decision:** Every viewer (buyer and all suppliers) sees real carrier names
on every bid row on the Auction Details page.
**Why:** Matches §1's literal "suppliers submit bids openly," and avoids a
per-role response-shaping layer for behavior the spec never asks for.

### 10. Status is computed, never stored
**Decision:** `Rfq` has no `status` column. `computeStatus(rfq, now)` is a
pure function called fresh on every read and inside every bid-submission
transaction.
**Why:** A stored status column is a second source of truth that can drift
from the timestamps it's supposed to reflect (e.g. if a background job that
updates it stalls or crashes). Computing it fresh means it's structurally
impossible for the displayed status to disagree with the timestamps that
define it.
**How closure still gets logged/pushed without a stored flag:** see #11 —
the ticker detects newly-due closures by checking whether a terminal
`AuctionEvent` exists yet, not by reading/writing a status field.
**Interview Q:** "How do you know when to notify clients that an auction
closed, if you never write a status change?" **A:** A periodic ticker looks
for RFQs whose `bidCloseAt` has passed with no terminal event recorded yet,
writes that event once, and broadcasts it — the event log is the trigger,
not a status column.

### 11. Auction ticker is idempotent by existence-check, not by flag-flipping
**Decision:** The ticker (single in-process `setInterval`, ~5s) finds RFQs
where `bidCloseAt <= now()` and no `CLOSED`/`FORCE_CLOSED` event exists yet,
and inserts exactly one such event per RFQ.
**Why:** Guarding on "does the terminal event already exist" rather than
"is some status flag already X" means a missed tick, an overlapping run, or
a server restart mid-scan can never produce a duplicate or inconsistent
closure. No `node-cron`, no separate worker process, no queue — a single
`setInterval` in the same Node process is sufficient at this scale, and the
whole system is safe to restart because no auction state lives in memory.

### 12. Precise definition of "rank change" (handles new entrants)
**Decision:** `rankChanged(before, after)` compares the ordered
supplier-id lists position-by-position, truncated to the shorter length —
if any position differs, it's a change.
**Why:** §6.3(b)/(c) never define what a "rank change" means when a brand
new supplier joins mid-auction. Truncating to the shorter list means: a new
supplier slotting in above existing bidders shifts their rank numbers and
correctly counts as a change; a new supplier's first bid landing at the
very bottom doesn't disturb any existing supplier's position and correctly
does not count under `ANY_RANK_CHANGE`/`L1_CHANGE_ONLY` (it still counts
under `ANY_BID`, which doesn't care about ranking at all).
**Interview Q:** "Does a brand-new supplier joining always trigger an
extension under the rank-change policies?" **A:** "Only if they enter above
at least one existing bidder. Entering at the bottom doesn't change anyone's
existing standing, so there's nothing to react to under those two policies
specifically — though it always counts as activity under `ANY_BID`."

### 13. `bidCloseAt` vs `forcedCloseAt`: two rules, not one
**Decision:** Enforce `bidCloseAt < forcedCloseAt` (strict) only once, at
RFQ creation, in the application layer. Separately, enforce `bidCloseAt <=
forcedCloseAt` (non-strict) as a DB CHECK constraint that holds for the
entire lifetime of the row.
**Why:** §7 states both "forced close must be greater than bid close" and
"extensions must never exceed forced close" as if they were the same rule.
They aren't: the first is about the initial configuration; the second has
to remain true even in the valid terminal state where an extension clamped
`bidCloseAt` to exactly equal `forcedCloseAt` (the Force-Closed case). A
single strict lifetime CHECK would make that terminal state a constraint
violation. Full detail in `docs/DATABASE_SCHEMA.md`.
**Interview Q:** "Why isn't this just one constraint?" **A:** As above —
conflating "must start smaller" with "must never exceed" breaks the one
scenario (Force Closed) the whole assignment is centered on.

### 14. `quoteValidityDays` modeled as a duration, not a date
**Decision:** "Validity of Quote" is stored as an integer number of days
from submission, not an absolute expiry date.
**Why:** The source doc doesn't specify units or format for this field.
"Valid for N days" is the conventional real-world meaning in freight RFQs,
and is simpler to validate (just a positive integer) than reasoning about
an absolute date relative to a moving submission time.

### 15. REST for every mutation; Socket.io only for server-initiated push
**Decision:** Bid submission and RFQ creation are REST endpoints, never
Socket.io emits. Sockets only carry events the server pushes unprompted
(new bid, extension, closure).
**Why:** REST gives standard HTTP status codes, reusable Express
validation middleware, and ordinary integration-test tooling (supertest).
Modeling a mutation as a socket emit-with-ack works but is a less standard,
harder-to-test pattern for something that's fundamentally a normal
request/response action.

### 16. `SCHEDULED` is real internally, cosmetic-only externally
**Decision:** `computeStatus` and the API always return `SCHEDULED` for an
RFQ before its `bidStartAt` — never collapsed into `ACTIVE` or hidden. The
frontend only shows a `Scheduled` badge when an RFQ is genuinely in that
state; for every RFQ that has started, the UI shows exactly one of the
assignment's three named statuses (Active/Closed/Force Closed), with no
fourth option ever competing with those.
**Why:** §8's status list assumes an auction is already running when
viewed, since it only names three values. A fourth value is necessary
internally for correctness (bidding must be rejected before `bidStartAt`),
but the UI shouldn't invent a status where the spec didn't ask for one — it
should just be honest on the rare occasion a pre-start auction is genuinely
what's being displayed.
**Interview Q:** "The spec only lists three statuses — why does your system
have four?" **A:** "Three are exactly what the spec names, for any auction
that's actually started. The fourth, `Scheduled`, exists purely to stop
bids from being accepted before the configured start time — a correctness
guard, not a reinterpretation of the spec's status list, and it only ever
surfaces in the UI when it's literally true."

### 17. "All supplier bids" and "Supplier ranking" are one table, not two
**Decision:** `GET /api/rfqs/:id` returns a single `bids` array — each
supplier's active bid, ranked with an `L1`/`L2`/... label — rather than a
full historical bid list plus a separate ranking summary.
**Why:** §8 lists "All supplier bids (sorted by price)" and "Supplier
ranking (L1, L2, L3, ...)" as adjacent bullets under the same Auction
Details page. Read as two separate views, they'd show nearly the same
information twice (a full bid history is already available, in full, via
the activity log, which the doc names as its own distinct section a few
lines later). Read as one table — current active bid per supplier, ranked —
each requirement is satisfied by the same rows without duplication.
**Interview Q:** "Where can I see a supplier's earlier, superseded bids?"
**A:** "In the activity log — every submission is logged there with a
timestamp and reason, active or historical. The bids table only shows each
supplier's current standing, which is what 'ranking' means."

### 18. Accepted `react-router-dom`'s one flagged advisory rather than downgrading into more of them
**Decision:** Kept `react-router-dom@7.18.1` (latest) despite `npm audit`
flagging a high-severity advisory (GHSA-qwww-vcr4-c8h2, "RSC Mode CSRF
Bypass Allows Action Execution Before 400 Response") against it.
**Why:** Read the advisory before reacting to the severity label: it's
specific to React Router's RSC (React Server Components) framework mode
with server actions — infrastructure this project has none of, since it's
a plain Vite-built client-side SPA using `<BrowserRouter>`/`<Routes>` for
client-only navigation, no loaders/actions, no server rendering. Checked
whether downgrading would help: pinning below the vulnerable range
(`7.11.0`) instead surfaces *fourteen* other advisories covering the same
kind of server-only surface (SSR XSS, single-fetch DoS, RSC redirect
handling) — strictly worse, not better, and equally inapplicable. `7.18.1`
is both the most current release and the smallest advisory list of any
version actually available.
**Interview Q:** "Why ship a dependency with a known high-severity CVE
instead of just fixing it?" **A:** "I read the advisory instead of trusting
the severity label alone — it requires a server-rendering feature this app
doesn't use. I also checked whether an older version was actually safer,
and it wasn't; it had more advisories, all in the same inapplicable
category. Latest-and-documented beat older-and-still-flagged."

### 19. Skipped client/server clock-skew correction for the countdown
**Decision:** `useCountdown` computes remaining time as `targetTime -
Date.now()` directly, with no server-time-offset correction, even though
`docs/HLD.md` §6 flags clock skew as worth handling.
**Why:** That correction matters when client and server run on different
hosts with drifted clocks — in local dev (and in how this gets demoed),
they're the same machine, sharing one clock. Building the offset-correction
handshake now would be defending against a scenario that structurally can't
happen in this deployment.
**Interview Q:** "Your own HLD says to handle clock skew — why didn't you?"
**A:** "I still think it's the right call for a real multi-host deployment
— have the server hand the client its own current time at `auction:join`
so the client can compute and subtract the drift. I didn't wire it up here
because client and server share a clock in this setup, so there's no drift
to correct for; adding it would be code with no failure mode it actually
prevents, here."

### 20. Public landing page split from the authenticated app (`/` vs `/dashboard`)
**Decision:** `/` is now a public, unauthenticated `LandingPage` (hero, feature
highlights, Login CTA). The auction listing — previously at `/` — moved to
`/dashboard`, behind `ProtectedRoute`. An already-authenticated user hitting
either `/` or `/login` is redirected straight to `/dashboard`.
**Why:** Requested for a proper first impression when this gets reviewed —
without it, `/` had no meaningful unauthenticated state (you'd either see a
login form or nothing). Splitting "marketing surface" from "the app" is the
standard SaaS pattern (a logged-in user should never see the marketing page
by accident, an anonymous one should never see the app shell).
**Interview Q:** "Why not just show the login form at `/`?" **A:** "A login
form doesn't explain what the product does. Someone landing on `/` cold
needs the 'what is this and why would I click Login' context first — that's
a different job than the authenticated app, so it gets a different route
and its own simple header instead of the sidebar shell."

### 21. AppShell mobile drawer: `hidden`/`flex` toggle, not a CSS transform
**Decision:** The sidebar's mobile drawer shows/hides via a plain
`hidden` / `flex` class toggle (`sidebarOpen ? "flex" : "hidden"`, with
`lg:flex` always winning above the `lg` breakpoint), not a sliding
`-translate-x-full` → `translate-x-0` transform.
**Why — the debugging story:** the transform approach was the first attempt,
and it silently failed: Tailwind v4 implements translate utilities via the
native CSS `translate` property (`translate: var(--tw-translate-x)
var(--tw-translate-x)`), not `transform`. Because nothing on the page ever
set a `translate-y-*` utility, `--tw-translate-y` was never defined, and
`var(--tw-translate-y)` with no fallback made the *entire* `translate`
declaration invalid at compute time — so it was dropped, and the sidebar
just sat at its untransformed position regardless of state. Confirmed by
inspecting the actual generated CSS rule, not just the className string.
Rather than patch around it (e.g. also setting a `translate-y-0` nobody
needs), switching to `hidden`/`flex` sidesteps the whole `translate`
property question, and happens to fit "avoid heavy animations" better too.
**Interview Q:** "Why does the drawer just appear instead of sliding in?"
**A:** "Partly deliberate scope (no animation library, no heavy motion),
partly because I hit a real Tailwind v4 quirk with the CSS `translate`
property depending on both axes being defined — I'd rather ship the simpler,
correct version than a fragile animated one."

### 22. Dashboard filtering is client-side; no new endpoint
**Decision:** The status filter (and the stat-card counts) operate entirely
on the array already returned by `GET /api/rfqs` — filtered and counted with
`Array.filter`/a single reduce in the component. No `?status=` query param,
no backend change.
**Why:** At this data scale (a handful of RFQs), filtering server-side would
mean a network round-trip for something a `.filter()` call does in
microseconds, plus a query-param contract to design, validate, and document
for no observable benefit. The stat cards double as the filter control
(clicking one both shows the count *and* filters to it), rather than
building two separate UI elements for the same underlying state.
**Interview Q:** "Wouldn't this fall over with 10,000 RFQs?" **A:** "Yes —
at that scale you'd want server-side filtering and pagination. That's a real
scaling boundary, but it's not *this* system's boundary; the whole app is
sized for a handful of concurrent auctions, and building for 10,000 rows
that will never exist here would be solving a problem this system doesn't
have."

### 23. The bid ratchet rule is scoped to the account, not the "Carrier Name" text
**Decision (confirmed, not changed):** "must be lower than your own previous
bid" compares against the authenticated supplier's (`supplierId`) last bid
on that RFQ — never against the free-text `carrierName` field. Two bids
typed under two different carrier names from the *same* logged-in account
are still the same supplier for this rule.
**Why this came up:** looked like a bug during testing — a "first" bid
under one carrier name got rejected as "not lower than your previous bid."
Checked the database directly rather than assume: both bids traced back to
the same `supplierId`, submitted from two browser tabs. localStorage-based
auth is shared across every tab on the same origin, so logging into a
second demo account in a second tab silently becomes the active identity
for API calls in *both* tabs — the first tab's UI still shows the old
name (stale React state), but a new request from it authenticates as
whoever logged in most recently, anywhere.
**Why not fixed with cross-tab sync:** a `storage`-event listener that
force-reloads auth state when another tab changes the token would solve
it, but that's real complexity for a workflow (multiple accounts open
side-by-side in one browser) that only comes up during this kind of manual
QA, not for an actual end user. Documented instead: use separate
browser windows or incognito sessions per account when testing multiple
suppliers at once — which is exactly what was done for the multi-tab
realtime tests earlier in this build.
**Interview Q:** "How do you know this is the intended design and not a
bug you're rationalizing?" **A:** "Because the spec's rule is 'suppliers
can continuously lower their prices' — a statement about the bidding
party, not about a free-text label. Carrier Name exists so a buyer can
tell quotes apart, not to identify who's allowed to bid; tying the ratchet
rule to it would let one account bypass the rule just by changing what it
types."

### 24. Product name (BidFlow) kept separate from the technical name (British Auction RFQ)
**Decision:** The UI is branded **BidFlow** (logo, page title, sidebar,
login) — a product name layered on top, not a replacement for how the rest
of the project (README, HLD, this document) refers to the system. Docs keep
calling it "the British Auction RFQ system" throughout, since that's the
literal terminology the assignment uses and what a grader is pattern-matching
against.
**Why:** These are two different jobs. "British Auction RFQ system"
describes *what it does*, in the assignment's own words — useful for
traceability. "BidFlow" is what a user sees on a button or a browser tab,
where the mechanism name is the wrong altitude of detail. Conflating them
would mean either a technical doc that reads like marketing copy, or a
product UI that reads like a spec.
**Also:** the provided logo asset is self-hosted (`frontend/public/logo.png`)
rather than referenced by its Cloudinary URL directly — same reasoning as
every other "don't take on an external dependency you don't need" call in
this project: the app should still render correctly regardless of whether
that Cloudinary account exists later.

## Pending
None currently. Next round of decisions surfaces during implementation —
see `docs/HLD.md` §10 for the day-by-day plan.
