# AI Context — drizzle-ballers

Context for future Claude Code sessions working on this repo. Read this first.

## What this site is
Static site (GitHub Pages, auto-deploys on push to `main` via `.github/workflows/static.yml`, no staging/PR gate) for booking kids' soccer classes. Booking + payment previously used Calendly (scheduling) + Stripe Payment Links (payment) + Formspree (email notifications) + localStorage (fake "database").

## Architecture decision: Option A (adopted)
Calendly's **native "Collect Payment"** feature (Stripe connected directly inside Calendly, under Calendly Integrations) is now the single source of truth for both slot booking and payment. This replaced the old flow of: pick slot in Calendly → redirect to a separate Stripe Payment Link → hope the two stay in sync.

Why: the old Stripe Payment Links were all identical/test-mode (not actually tied to tiers), and the "paid bookings" tracking in `admin.html` read from a per-device `localStorage` ledger (`drizzle_bookings`) that isn't a real shared database — two different browsers/devices would show different "truth." Calendly-native payment collection makes Calendly + Stripe's own dashboards the actual system of record; nothing needs to be reproduced client-side.

Key constraint discovered: Calendly's public API (v2) and its official MCP server (`https://mcp.calendly.com`, GA Feb 2026) can list/read event types and bookings, but **cannot create or configure payment-enabled event types** — no payment/Stripe fields are exposed via API. Event types with "Collect Payment" turned on must be created/edited manually in the Calendly UI. Do not attempt this via API/MCP again — it's been confirmed unsupported.

Pricing model: **one Calendly event type per kid-count tier** (not a single event type with dynamic pricing), since Calendly's native payment is a fixed price per event type. Originally implemented as `beginners`/`experienced` × `1–6` kids (12 event types).

## Age-group refactor (completed 2026-09-06)
`index.html` now uses three age groups — **Under 5**, **6–7**, **8–9** — instead of `beginners`/`experienced`, and private/1-on-1 sessions were removed entirely (the private program card, `private-booking-step`, `#calendly-private`, `#private-confirmed`, `showPrivateBooking()`, `renderPrivateWidget()`, `resetPrivateBooking()`, `showPrivateConfirmed()`, `PRIVATE_EVENT_URL`, and the private branch of the `message` listener are all gone). The multi-kid volume-discount pricing (`PRICES`/`SAVINGS`, kid counter UI) was also dropped — Calendly now has one flat $35 event type per age group, so pricing is a single `PRICE = 35` constant; parents with multiple kids book multiple times.

Real event data (pulled via the connected Calendly MCP, not guessed):
- Paid: `age-group-u5`, `age-group-6-7`, `age-group-8-9` (all $35, 75 min, confirmed verbally by user — price isn't exposed via API)
- Free trial pass per group: `free-pass-age-group-u5`, `free-pass-age-group-6-7`, `free-pass-age-group-8-9`
- Location is intentionally `TBD` on all event types for now.

The hardcoded "Weekly Schedule" section was **removed** (not just updated) because the real Calendly availability schedule isn't finalized yet — the user confirmed their intended Pacific-time schedule doesn't cleanly match what's currently configured in Calendly ("it is mixed"). The live Calendly inline widget now shows real bookable times instead of static copy, so the site can't go stale relative to Calendly. Revisit adding schedule-summary copy back once the user finalizes a clean weekly recurring pattern in Calendly's own availability settings.

Note: the Calendly account's default "Working hours" availability schedule is correctly set to `America/Los_Angeles` — an earlier session miscalculated using `America/New_York` (the value on the *user profile*, not the schedule) and got implausible late-night times before catching the mismatch.

## Calendly MCP access
`mcp__claude_ai_Calendly__*` tools are connected (a "claude.ai Calendly" integration; a separate community/PAT-based `mcp__calendly__*` server was tried and removed — see git history if resurrecting it). Grounding order for these tools:
1. Call `users-get_current_user` first to resolve host URI/scheduling_url (its `timezone` field is the *account profile* timezone, not necessarily the same as the availability schedule's timezone — check `availability-list_user_availability_schedules` for the schedule's own `timezone` when hours/times matter).
2. Call `event_types-list_event_types` (filtered to that user URI) to see current event types before reasoning about them.
3. Check `list_calendly_skills` for named workflows (reschedule, cancel-and-rebook) before improvising those flows.

These tools can list/read event types and availability but still cannot create/edit payment-enabled event types or read prices (payment config is UI-only in Calendly, confirmed unsupported twice now). Always confirm price with the user rather than assuming.

## Files
- **`index.html`** — main site markup only; styling and behavior were split out (2026-09-06) into `styles.css` and `script.js`, linked normally (`<link rel="stylesheet">` / `<script src>`). Don't re-inline them.
- **`styles.css`** — all page CSS, moved verbatim out of the old inline `<style>` block.
- **`script.js`** — all page behavior. Key pieces:
  - `CALENDLY_EVENTS` — flat map of the 3 paid age-group event URLs (`u5`/`6-7`/`8-9`).
  - **Group class booking** (`openAgeGroupBooking()`): clicking an age group opens that Calendly event in a **new tab** (`window.open(..., '_blank', 'noopener')`) rather than an embedded widget. There is no in-page "Booked & Paid" confirmation or booking-notification email for this flow anymore — this page can't observe what happens in a separate tab, so Calendly + Stripe's own dashboards are the only record (matches what `admin.html` already assumes).
  - **Free class claim** (`claimFreeSession()`): different pattern on purpose — after a successful claim, the matching free-pass Calendly event renders as an **inline embedded widget** (`Calendly.initInlineWidget`) right on the page, so the parent never leaves. This is intentional per user request ("don't want the user to go to another window"), not an oversight — don't "fix" it to match the group-booking new-tab pattern.
  - Why the two flows differ: **Apple Pay / Google Pay only appear at Calendly checkout on a direct link, not inside an embedded/inline widget** (confirmed via Calendly's own help/community docs, June 2025 wallet-payment rollout). The free class pass is $0 (no payment step), so embedding it inline has no wallet-payment downside — but the paid group-class events need the new-tab/direct-link treatment for wallet payments to actually show up. If asked to "add Apple Pay/Google Pay," the fix is almost always on the **Stripe dashboard** side (Settings → Payment methods) — there's no Calendly API/MCP surface for this at all, and no Stripe MCP is connected in this project.
- **`admin.html`** — password-gated (`ADMIN_PASSWORD = 'drizzle2025'`, hardcoded — flagged as insecure but not fixed, low priority since it's just an admin convenience page). "Paid Bookings" stats/table were removed and replaced with links to the real Calendly dashboard (`https://calendly.com/app/scheduled_events`) and Stripe dashboard (`https://dashboard.stripe.com/payments`). The separate **free-session-claim tracker** (`localStorage` key `db_free_sessions`, its own table/CSV export/status update) is untouched and out of scope — it has a known device-local duplicate-check limitation, not yet addressed.
- **`success.html`** — deleted (`git rm`); nothing redirects there anymore since Calendly's own confirmation (widget or new tab) now closes the loop.

## Known accepted limitations (not bugs to "fix" reflexively)
- `admin.html` password is client-side/hardcoded — acceptable for now, it's just a convenience gate, not real auth.
- Free-session-claim dedup is per-device localStorage, easily bypassed cross-device — accepted as-is; user explicitly said this is defensive-only and not worth a backend unless real abuse shows up.
- No in-page confirmation for the paid group-class booking flow (new-tab, can't observe completion) — intentional tradeoff for wallet-payment support, not a gap to fill.

## Working style notes for this project
- User makes architecture decisions via short direct replies ("lets go for option a") — don't over-explain before asking, use `AskUserQuestion` for concrete forks (e.g. pricing-model choice) rather than assuming.
- Don't invent Calendly URLs/prices/hours — always get them from the user or by reading via the connected Calendly MCP tools.
- Confirm scope explicitly when the user says something is being removed entirely (e.g. private sessions) — sweep all related code paths, not just the visible UI.
