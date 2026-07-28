# Testing Checklist — What an Interviewer Would Probe

Organized by how likely each area is to come up, not alphabetically. Items
marked **[verified]** were explicitly tested during the build (with
evidence in the conversation this doc was written from); everything else is
worth checking yourself before a follow-up interview.

## 1. Time boundaries & forced-close (the actual point of the assignment)

- [ ] **[verified]** A bid at the exact instant of `bidCloseAt` is rejected — the
      window is half-open (`now < bidCloseAt`), not inclusive.
- [ ] **[verified]** An extension that would push `bidCloseAt` past `forcedCloseAt`
      gets clamped to land *exactly* on the ceiling, not past it.
- [ ] **[verified]** Once `bidCloseAt` already equals `forcedCloseAt`, a further
      qualifying bid produces **no** additional "Extended" log entry (silent
      no-op, not a duplicate/zero-length extension).
- [ ] **[verified]** An RFQ that closes without ever reaching the ceiling shows
      **Closed**; one that gets extended all the way to the ceiling shows
      **Force Closed**. Same final `bidCloseAt` value, different label,
      driven entirely by whether it equals `forcedCloseAt`.
- [ ] **[verified]** A bid attempt before `bidStartAt` (Scheduled) is rejected.
- [ ] Try bidding in the last ~2 seconds before close via the UI — confirm
      it's accepted or rejected consistent with the countdown shown (no
      client/server clock disagreement in local dev, since they share a
      clock — see Interview Notes #19 for why that's a deliberate scope cut).

## 2. Extension trigger types — the subtle part

- [ ] **[verified]** `ANY_BID`: any bid inside the window extends, even one that
      doesn't change anyone's rank at all (e.g., a supplier re-lowering
      their own price while staying in the same position).
- [ ] **[verified]** `ANY_RANK_CHANGE`: a reorder *below* L1 (L2 and L3 swapping)
      still triggers — it doesn't need to touch the leader.
- [ ] `L1_CHANGE_ONLY`: a bid that reorders L2/L3 but leaves L1 untouched
      should **not** trigger. Only test not yet re-confirmed live after the
      polish-phase changes — worth one manual pass.
- [ ] **[verified]** A brand-new supplier's first bid landing *below* everyone
      already there does **not** count as a rank change (nobody's existing
      position moved) — but it **does** count under `ANY_BID`.
- [ ] A brand-new supplier's first bid landing *above* everyone (new L1)
      correctly triggers under all three types.
- [ ] A bid placed well outside the trigger window (e.g., minutes before an
      auction with a short window) produces **no** extension, regardless of
      trigger type — confirms the window check runs before the trigger-type
      check, not after.

## 3. Bid validation — the ratchet rule

- [ ] **[verified]** A supplier's first-ever bid on an RFQ is unconstrained
      (no "previous bid" to compare against).
- [ ] **[verified]** A second bid **equal to** the supplier's first is rejected
      (`>=`, not just `>` — equal doesn't count as lower).
- [ ] **[verified]** The ratchet is scoped to the **authenticated account**, not
      the free-text Carrier Name — two bids under different carrier names
      from the same login are still "your own previous bid." (This is the
      thing that looked like a bug and wasn't — Interview Notes #23.)
- [ ] **[verified]** A double-click / rapid resubmit of the identical bid is
      blocked twice over: the frontend disables the button while a request
      is in flight, and even if that were bypassed, the second identical
      request would lose the race for the row lock, see the first one's
      bid as its "previous," and get rejected by the same `>=` check — not
      a separate mechanism, the same one.
- [ ] Negative or zero charges — should fail validation before ever reaching
      the ratchet check.
- [ ] Bid on a Closed/Force-Closed RFQ → 409. Bid on a nonexistent RFQ id →
      404. Bid submitted by a buyer account → 403. All three have distinct
      status codes on purpose, not a generic "bad request."

## 4. RFQ creation validation

- [ ] **[verified]** `forcedCloseAt <= bidCloseAt` rejected (strict, creation-time
      only — see Interview Notes #13 for why this is *not* the same rule as
      the lifetime `<=` invariant enforced at the DB level).
- [ ] **[verified]** `triggerWindowMin` longer than the auction's initial
      duration (`bidCloseAt - bidStartAt`) is rejected outright.
- [ ] Duplicate `referenceId` → 409, not a 500.
- [ ] RFQ creation attempted by a supplier account → 403, and the frontend
      route itself (`/rfqs/new`) redirects a supplier away before they'd
      ever see the form.

## 5. Concurrency (the thing the assignment cares about most)

- [x] **[verified live]** Two different suppliers bidding on the same RFQ at
      effectively the same instant — fired via two backgrounded `curl`
      requests hitting `POST /rfqs/3/bids` at the same wall-clock moment.
      Both returned `201`. The actual submit timestamps landed ~900ms apart
      (`22:41:09.955` and `22:41:10.868`) even though the requests were
      issued together — proof the row lock serialized them rather than
      letting both read a stale pre-insert snapshot. The second response's
      ranking correctly included the first bid, and the final state showed
      exactly 3 bids (one per supplier), correctly ordered — no duplicate
      or missing rows, no corrupted ranking. This is the one item on this
      list that's genuinely hard to verify by clicking through a UI, so I
      ran it directly instead of just asserting it should work.
- [ ] A bid landing inside the trigger window at the same moment the ticker
      is evaluating a *different* RFQ for closure — these touch different
      rows, so no lock contention, but worth knowing the ticker and bid
      submissions use the same locking pattern for exactly this reason.

## 6. Realtime / Socket.io

- [ ] **[verified]** Room isolation — a client watching RFQ A's details page
      doesn't receive events for RFQ B.
- [ ] **[verified]** The listing page's row-level patch and the details page's
      full refetch both work independently and don't interfere.
- [ ] **[verified]** A socket connecting with an invalid/missing token is
      rejected at handshake, not silently allowed through.
- [ ] Kill and restart the backend while a client is connected — Socket.io's
      default client reconnection should pick back up automatically. Not
      explicitly re-tested after the polish phase.

## 7. Auth & sessions

- [ ] **[verified]** JWT expiry (2h) — no auto-redirect on 401 by design; a
      stale session shows a generic error toast on the next request rather
      than silently working. Documented trade-off, not an oversight.
- [ ] **[verified]** Two accounts logged in across two tabs of the *same*
      browser silently collide — localStorage is shared per-origin, so
      whichever tab logged in most recently wins for **all** tabs' API
      calls. Use separate browser windows (or incognito) for genuine
      multi-account testing, not two tabs.
- [ ] **[verified]** Direct navigation to a protected route while logged out
      redirects to `/login` and returns you to that exact route after
      signing in.
- [ ] **[verified]** Visiting `/` or `/login` while already authenticated
      redirects straight to `/dashboard`.

## 8. Role-based access

- [ ] **[verified]** Buyer: sees no bid form on any RFQ, regardless of status.
- [ ] **[verified]** Supplier: sees no "Create RFQ" nav link, and a direct hit
      on `/rfqs/new` bounces to `/dashboard`.
- [ ] **[verified]** Both roles can view every RFQ's full details — open/
      transparent bidding is intentional (Interview Notes #9), not a gap.

## 9. Data & display

- [ ] **[verified]** Zero-bid RFQ shows the empty state, not a broken/empty table.
- [ ] Two suppliers tying on total price exactly — confirms the tie-break
      (earliest submission wins the better rank) rather than showing
      duplicate/ambiguous rank labels. Not manually re-verified recently.
- [ ] **[verified]** Dashboard stat-card filter with a zero-count category shows
      the "no auctions match this filter" state with a working clear button.

## 10. Responsive

- [ ] **[verified]** Mobile (375px): sidebar hidden by default, hamburger opens
      it as an overlay, closes via the X, the overlay click, or navigating
      — all three close paths confirmed.
- [ ] **[verified]** Desktop (1280px+): sidebar always visible, hamburger
      button not present in the DOM's visible layout.
- [ ] **[verified]** No horizontal page scroll at any tested width; wide tables
      scroll within their own container instead.

---

## One gap found while writing this list

Both `AuctionListingPage` and `AuctionDetailsPage` handle a failed initial
fetch by showing an error toast — but the toast auto-dismisses after 4
seconds, and the page is left showing a spinner **forever**, because
nothing ever sets `rfq`/`rfqs` to a non-null "failed" state. Concretely:
visiting `/rfqs/9999` (a nonexistent RFQ) or `/rfqs/abc` (invalid id) leaves
you looking at an infinite spinner once the toast disappears, instead of a
clear "RFQ not found" message. Not caught earlier because every test so far
used real, valid RFQ ids. Want me to fix it?
