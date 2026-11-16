# Cover Check — Design system and screen design

Product designer notes for the Cover Check funnel (Rung 1 Cover Quiz, Rung 2 Policy Upload, telecaller hand-off).
Source spec: *Cover Check funnel, Draft v1, 3 Oct 2026*.

## 1. What I took from Turtlemint's public brand

| Signal | What I found | How it is used here |
| --- | --- | --- |
| Brand colours (Brandfetch registry for turtlemint.com) | Green Haze `#009F69`, Bermuda mint `#7BDCB5`, Orient blue `#005A87` | Green is the brand voice, mint is the illustration fill, Orient blue is the "information / trust" accent |
| Site tone | "Insurance made simple", "All your insurance in one place" — short, friendly, benefit-first | Copy is plain, second person, one idea per line |
| Visual language on turtlemint.com / turtlemintinsurance.com | Flat illustrations around app tasks (manage policy, handle claim, renewal reminder), light grey / white sections, rounded cards, line icons | Flat, rounded, two-tone illustrations on soft mint "blobs"; line icons at 1.75 px stroke |
| Mascot / campaign art (Mahashay) | Character-led campaign illustration | Not reused. Cover Check uses its own neutral objects (shield, policy sheet, magnifier) so it never looks like an ad |

I could not read Turtlemint's production CSS from this sandbox, so exact type and radius values are my design decisions, not extracted values. Swap the tokens in `frontend/src/styles/tokens.css` if the brand team has an official file.

## 2. Colour tokens

Brand green `#009F69` on white is **3.4 : 1** — fine for icons and large text, too weak for button labels. So the CTA uses a deeper step of the same hue.

| Token | Hex | Use | Contrast on white |
| --- | --- | --- | --- |
| `--mint-700` | `#00875A` | Primary button fill, selected state, green text | 4.55 : 1 (AA) |
| `--mint-600` | `#009F69` | Brand accent, progress fill, icons, illustration key colour | 3.41 : 1 (UI only) |
| `--mint-300` | `#7BDCB5` | Illustration mid-tone | — |
| `--mint-100` | `#DDF5EA` | Selected tile background, blobs | — |
| `--mint-50` | `#F1FBF6` | Screen wash behind illustrations | — |
| `--ocean-700` | `#005A87` | Links, "Worth asking" badge, info notes | 7.5 : 1 |
| `--ocean-50` | `#E7F2F8` | Info note background | — |
| `--ink-900` | `#14232B` | Headings and body | 16.1 : 1 |
| `--ink-600` | `#4D5F68` | Secondary text, "why we ask" lines | 6.7 : 1 |
| `--line` | `#DCE4E7` | Borders, dividers | — |
| `--canvas` | `#F6F8F7` | Page background | — |
| `--amber-700` / `--amber-50` | `#9A5B00` / `#FFF4E0` | "Review" points (never red: we are not alarming people) | 5.4 : 1 |
| `--danger-700` | `#B42318` | Form errors only | 6.5 : 1 |

Rule: red is reserved for input errors. Findings use amber / blue / green so the readout never reads as a scare (journey risk: "Reads as a scare").

## 3. Type

* **Headings: Poppins 600** — geometric, friendly, and ships Devanagari, so Hindi and Marathi headings keep the same shape.
* **Body and UI: Hind 400/500/600** — same foundry family feel, Latin + Devanagari, very legible at 16 px on low-end Android.
* Scale (mobile): Display 26/32, H1 22/28, H2 18/24, Body 16/24, Small 14/20, Caption 12/16.
* Never below 14 px for anything a person must read. Numbers use tabular figures.

## 4. Shape, space, elevation

* 4 px grid. Screen gutter 20 px. Stack gaps 8 / 12 / 16 / 24.
* Radius: tiles and inputs 14 px, cards 18 px, buttons 999 px (pill — matches the soft, rounded brand feel), chips 999 px.
* Elevation: one soft shadow for the sticky footer and lead card only. Everything else is flat with a 1 px line.
* Tap targets ≥ 48 px; option tiles 56 px.

## 5. Illustration rules

* Flat, two-tone (mint-600 + mint-300) with ink-900 outlines at 2 px, on a mint-50 rounded blob.
* Objects, not people: shield, policy sheet, magnifier, calendar, chat bubble, headset, padlock. This keeps the flow neutral and avoids stock-photo "family smiling" imagery that reads as an ad.
* A hexagon pattern (from a turtle shell) is the Cover Check motif: it appears inside the shield and as a faint texture on the landing blob. It hints at the brand without copying the logo.
* One illustration per screen at most, never on question screens S1–S6 (they need the space for answers). Illustrations appear on S0, S7, S8, S10, U1, U4, U6 and empty / error states.
* All illustrations are inline SVG React components in `frontend/src/illustrations/`, so they recolour from tokens and weigh < 2 KB each.

## 6. Components

| Component | Notes |
| --- | --- |
| `ScreenShell` | Top bar (back, step label, language switch), segmented progress (6 steps), scroll body, sticky footer with primary CTA. |
| `OptionTile` | 56 px, full width, radio or checkbox affordance on the right. Selected = mint-100 fill + mint-700 border. |
| `NotSureTile` | Same size as other tiles, dashed border, "?" glyph. Equal weight: not knowing is a valid, useful answer. |
| `Chip` | Optional sub-answers (condition tags). Never required. |
| `Stepper` | Children count 1–6, 48 px buttons. |
| `NumberField` | `inputmode="numeric"`, inline range hint, error under field. |
| `WhyLine` | 14 px ink-600 line with an info glyph under every capture field: "Why: …". |
| `ConsentBox` | Unticked checkbox, full sentence label naming the number, links to notice version. Never pre-ticked, never bundled. |
| `FindingCard` | Badge (Review / Worth asking / Fine), plain sentence, optional "what it may mean on a real bill". |
| `NoticeLine` | Lock glyph + one line, appears above the primary CTA wherever data is saved. |

## 7. Screen by screen design decisions

**S0 Landing.** Headline from the door (get / check / company / review). Three-fact strip: 60 sec · 6 questions · No upload, no login. Notice line above the CTA. Secondary text button "I have my policy handy — upload it". Language pill top right.

**S1 Router.** Three large tiles with a small icon each. First tap logs `save_answers` consent with notice version (spec: S0 notice + first tap). Auto-advance 250 ms after tap, no Next button: one tap, one screen.

**S2 Who is covered.** Multi-select tiles; age field slides in under the tiles; children stepper and parents' age band appear only when those tiles are picked (progressive disclosure keeps the heaviest screen light).

**S3–S6.** One question per screen where possible; where the path needs two (C on S3, B on S4) the second question only appears after the first is answered. Single-question screens auto-advance.

**S7 Readout.** Two stacked sections on mobile, "What you know" (green ticks) and "What to check" (amber/blue cards). No score, no insurer names. Two CTAs: "Save and explain this to me" (primary) and "Check my full policy" (secondary).

**S8 Save your summary.** Three fields, each with a Why line. Mobile shown masked with "Yes, this is my WhatsApp" toggle and "Use a different number". City/state fill in after 6 digits. Footer notice: "A call is never part of this step."

**S9 What next.** Four equal tiles in a 2 × 2 grid, nothing pre-selected. Choosing advisor reveals the call form inline: day, 2-hour slot (only slots inside permitted calling hours, only future ones), language, topic, note (140 chars with counter), unticked contact consent. OTP sheet appears only if the mobile isn't verified yet.

**S10 Confirmation.** What happened, with time; the call slot if any; how to stop (Reply STOP / Withdraw button); "This link stays valid for 14 days".

**U1–U8 Upload.** Consent card lists "What we read" vs "What we don't need" in two columns, retention line. OTP with 30 s resend timer and attempts left. File picker with three slots, per-file status, password field only for locked PDFs. Reading screen with three-step progress and "You can close this — we'll WhatsApp you". Check-what-we-read list with Edit per fact and "Not found — please enter it" empty state. Summary sections each show "p. 3" page chips. Points to review as cards with badges and "How an expert can help" lines.

**Telecaller lead card.** Desktop card: name + state + priority badge, then labelled rows (Where, Asked for, Situation, Quiz, Told them, Policy upload, Consent), then a suggested first-minute script built from their own answers. Data the person did not give is shown as "—", never inferred.

## 8. Accessibility and performance

* AA contrast everywhere text appears; focus ring 3 px mint-300 + 1 px ink.
* All tiles are real `<button>`s / `<input>`s with labels; progress has `aria-valuenow`.
* Motion limited to 150–250 ms fades/slides; honours `prefers-reduced-motion`.
* Budget: < 90 KB JS gzipped, no images except inline SVG, works on 3G.

## 9. v2 — value before and after the ask

**S7 Your cover snapshot** replaces the two-column readout. Order: checklist progress ring (“3 of 5 boxes ticked”),
*What’s working for you* (strengths, each with its source), *How you compare* (charts), *Your cover checklist*.
Open boxes are expanded with what it means, how to check, a next-step button and “I’ve checked this”.
No overall score: the ring counts boxes, not quality.

**Charts** (`ui/charts.tsx`, dataviz method): stacked share bar for how insured Indians are covered
(series `#3A86C8 / #E39A1B / #00875A`, validated — CVD ΔE ≥ 14, normal ΔE ≥ 26; the amber is below 3:1 so every
segment has a legend and a direct readout), single-measure bars for cover vs the 2025 average vs its value in five years,
a meter for waiting-period months served, and a per-area status strip. Bars ≤ 16 px, 4 px rounded data-ends, 2 px gaps,
values in ink, hover/focus readouts, hidden data tables for screen readers. Status always shows an icon and a word.

**S9a Plans that fit** shows plan *types* (never insurer products), each with “why this fits you”, two plain facts,
“See … on Turtlemint” (UTM-tagged link to turtlemintinsurance.com) and “Talk to an advisor about this” (opens the call
form with the plan pre-filled).

**S9b Summary preview** shows the exact WhatsApp message in a chat mock before anything is sent. S8 no longer sends;
the summary goes out only from S9b. An optional, unticked box lets them agree to a follow-up.

**U7 Where your policy can be stronger** reads the confirmed facts: area strip, cover chart, waiting-period meter,
one card per gap (meaning on a real bill, what you can do), plan types that fit the policy, and a sticky
“Talk to an advisor”.

## 10. v3 — short quiz, one-screen advice

See `docs/FLOW_V3.md` for the question inventory and the reasons behind it. Design notes:

* **Answers are taps.** Age is a chip row, never a keypad. Single-question screens move on by themselves. The progress line says "3 steps left" instead of "Step 2 of 6".
* **The result fits one screen** down to about 690 px of usable height, the WhatsApp in-app browser on a 6" phone. This is checked in the test run for all three paths.
* **Risk colour.** v3 adds `--risk-700/100/50` (`#B42318`) for what a gap costs: the "₹15 L short" hatched gauge, the bill-in-months bars and the gap rows.
  It always comes with a warning icon and words, never colour alone. Wins stay mint. Red for input errors is unchanged.
* **Charts:** a gauge for cover vs need (green, then a hatched red shortfall), a stacked bar for how to build the suggested cover (segments labelled inside),
  and bars for a ₹2/5/10 L bill in months of take-home pay (tagged "Example").

## 11. v4 — the Cover Report

**Why it changed.** The v3 result read as text. Normal people remember one number and one picture. So the result leads
with a single figure, how protected you are, and every view after that is a chart with one sentence.

**S7, at a glance (one screen, no scroll):**
* A protection donut: green for the share of the needed cover they have, hatched red for the rest. The big number reads "You're only 25% protected".
* Next to it: You have / You need, and in red "₹15 L of a big bill would be yours".
* Three number-led risk tiles: "₹0 — cover the day you leave your job", "−₹15 L — short of what you need", "½ — of a bill can be cut by a room cap".
* A one-bar bill split: "If a ₹20 L hospital bill came today: Policy ₹5 L | You ₹15 L".
* A link to the full report, the next call slot (urgency from real calling hours), and a sticky "Fix my cover — free advisor call".

**S7d, the full report (swipe cards, one chart each):**

| Card | Chart | Who sees it |
| --- | --- | --- |
| How protected you are | Donut today → donut in 5 years (13% medical inflation) | Everyone (a single 0% donut for no cover) |
| If you're hospitalised | Stacked bars for ₹2/5/10/20 L bills: policy pays vs you pay (+ months of pay) | Everyone |
| The waiting clock | Timeline: buy now → covered from 2029; wait a year → 2030 | No cover |
| The day you leave your job | Step chart ₹5 L → ₹5 L → ₹0 | Company cover only |
| Room-rent cap | Example ₹3 L bill split in half | Cap, or not sure |
| Your cover is shrinking | Line: what the cover buys over 10 years vs what the family needs | Anyone with a known amount |
| Where you stand | Donut of how insured India is covered (IRDAI), with "You" marked; or the 30% with no protection (NITI) | Everyone |
| Your fix | 1–3 numbered steps, each linking to the Turtlemint plan page | Everyone |

**Sources:** regulator, government and actuarial figures only, plus Turtlemint's own data. Never a competitor, as a source or a link, and a test enforces it.
Comparisons are against **what this family needs** (our stated rule), not a market average.
A slot for Turtlemint's own "average cover bought" (`FIRST_PARTY`) stays hidden until real data is filled in.

## 12. v5 — the Policy Report (upload path)

**Why it changed.** After uploading a policy, people got a text list ("What your policy says") and then a strip of
statuses. They had just handed us their document and got less value back than the quiz gave. Now the upload path
gets the same treatment as the quiz: one number, a picture, and everything read from *their* policy.

**U6, at a glance (one screen, no scroll at 390×690):**
* A policy chip: insurer · plan, so they know we read *their* document.
* Protection donut: "Covers only 25% of what you need", Policy cover ₹5 L / You need ₹20 L, and in red "Falls to 14% in 5 years".
* Three tiles, most urgent first. Each says something the hero doesn't: "44 days until your policy renews", "₹5,000 a day room-rent cap",
  "26 mo until existing illnesses are covered" (then co-pay %, people sharing one cover, benefits not found).
  "Short of what you need" is *not* a tile: the donut and the bill bar already say it in rupees.
* Bill bar for a bill the size of their need, after co-pay: "Policy ₹5 L | You ₹15 L".
* "See your full policy report" (10 cards), next free call slot, sticky "Fix my cover — free advisor call",
  plus "Plans that fit" (U8) and "In plain words" (opens the report on the plain-words card).

**U7, the full policy report (swipe cards, one chart each; a card appears only when the document supports it):**

| Card | Chart | Read from |
| --- | --- | --- |
| Your policy vs your needs | Donut today → in 5 years | Sum insured + cover rule + Milliman 13% |
| If you're hospitalised | Policy pays / you pay for ₹2/5/10/20 L, co-pay aware | Sum insured, co-pay |
| Who shares your cover | People icons joined to one ₹5 L block | Members (floater) |
| Waiting periods | Meter: 10 of 36 months served, "Covered from Nov 2028" | Start date, PED wait (IRDAI MC) |
| Room-rent cap | ₹5,000/day cap vs a room at twice the cap → example bill split | Room-rent clause (1% of SI) |
| Your renewal | Ring of days left in the policy year | End date |
| Benefit by benefit | 2-column scorecard: Weak spot / Strong / Not found (icon + word) | Each benefit |
| Your cover is shrinking | Line: what the cover buys vs need, 10 years | Sum insured + Milliman |
| Your policy in plain words | The old U6 list, with page chips — now one card, not the first thing they see | Every fact, with page |
| Your fix | 1–3 steps (super top-up, remove cap, co-pay waiver, renew on time, check missing benefits), Turtlemint links | All of the above |

**Rules kept:** nothing is guessed — a benefit not in the pages uploaded is "Not found" and becomes a reason to talk to an advisor;
urgency is factual (days to renewal, months to wait), never invented; the floater and room-rent examples are labelled as examples.
Logic lives in `shared/src/policyReport.ts` (`buildPolicyReport`) and is tested in `policyReport.test.ts`.

## 13. v4 — one screen in, one screen out

**Onboarding (S1)** follows a travel-search pattern: stacked white cards on a soft mint-to-canvas wash, and only one card open.
* A closed card is a 46px row: label on the left in ink-600, answer on the right in ink-900 semibold, or "Add" in ink-400.
* The open card has a 22px radius and a deeper shadow, with a Poppins 22px question ("Who's in your family?").
* Selected chips are filled mint-700 with white text. Tiles get a mint-50 fill and a mint-700 ring. Steppers are 34px circles.
* Footer: the consent notice (one small line), **Clear all** (underlined text), and a primary pill that reads **Next**, then **See my cover plan** (grows, sparkle icon).
* Tapping a chip that completes a card closes it after 180ms and opens the next one. Reduced motion turns off the open animation.

**Cover plan (S7)** is a bento board on canvas:
* A green hero (mint-700 to mint-800 gradient, white emblem seal).
* A 2×2 grid of white blocks with an 18px radius. Each block has an icon and title, a "Cover you need" caption, a big Poppins number, one line of rule, and a pill.
* The Turtlemint pick block has a mint-50 wash, a black "Turtlemint pick" badge and 2 one-line ticks.
* Have-vs-need bar: 8px tall, mint-600 for what they have, hatched risk for the rest, with the words "You have ₹5 L · 25%" underneath. Status is never shown by colour alone.
* Risk line: risk-700 with an alert icon. "Enough for today" uses mint-800 with a check icon.
* The price pill reads "See plan details →" until Turtlemint enters a real price, then "From ₹X/mo →".
* **Plan details** open a bottom sheet (24px top radius, handle, Esc or backdrop to close, focus moves into it). It never opens a new page.

**Fit rule:** every state fits 390×690 with no scroll. Under 660px tall, compact mode hides the title, eyebrow and "Cover you need" captions.

## 14. v5 — persona boards (S7 and U6)

* **Hero:** a small eyebrow (persona, or insurer and plan), a one-line headline written for their situation, and a two-line
  note about their life. No seal, so the text gets the room.
* **Priority chips** sit on the right of each block title: **Must have** (risk tint) · **Good to have** (ocean) · **Later** (amber) ·
  **Not for you** (grey) · **Covered** (mint, check icon). Colour always comes with the word.
* **Honest blocks:** "Later" and "Not for you" blocks are muted (canvas fill, grey ring), say "Not yet" or "Skip it" with a
  short reason, and open a **Why?** sheet. They are never hidden.
* **Our advice vs Turtlemint pick:** when the advice is not to buy (keep your plan, check your policy first), the badge reads
  **Our advice** on a deep mint fill and the pill reads "See why" or "Check my policy".
* **Inside your policy (U6):** a full-width block with a 2×2 grid of check tiles. Each tile has a status icon in a tinted
  circle, a small label and a bold value. Tapping a tile opens an info sheet: status chip, plain words, **What we'd do**,
  the page chip, and the source.
* **Plan sheet:** "For you" (mint box), 3 facts, **Good to know** tips (ocean box, info icons, at most 3), the source line,
  then the price or "your advisor gets you the exact quote".
* **Fit:** every persona and the policy board fit 390×690 with no scroll. Under 660px tall, compact mode also hides the
  second tick and tightens the gaps.
