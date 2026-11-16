# Cover Check v3 — shorter quiz, advisor-style result

Feedback: too many questions; people will likely drop after question 2. People without cover were asked about a
policy they don't have. The result read like content, not advice.

## 1. Question inventory — what stays, what goes, and why

| Question (v2) | No cover (A) | Own policy (B) | Company (C) | Why |
| --- | --- | --- | --- | --- |
| Where do you stand? | Keep | Keep | Keep | The only router. Decides everything after it. |
| Who to cover / who is covered | Keep | Keep | Keep | Decides floater vs individual, and whether parents need their own plan. |
| Eldest age — typed number | **Chips** | **Chips** | **Chips** | Typing on a keypad was a known drop point. Five chips give the same advice. |
| How many children (stepper) | Drop | Drop | Drop | Doesn't change the advice. The advisor can ask. |
| Parents' age band | Keep, only if parents picked | Same | Same | Over 60 means a separate senior plan. Shown inline, not as a new screen. |
| Cover amount | **Drop** | Keep | Keep | A has no policy, so we recommend an amount instead of asking. |
| Family in company cover | — | — | Keep | Biggest gap for company-only people. |
| Health condition + chips | **Drop** | **Drop** | — | Sensitive, a known drop point, and the advice doesn't depend on it. The advisor asks on the call. |
| Policy age | — | **Drop** | — | Only refines waiting periods. The policy upload gives the exact answer. |
| Cover after leaving job | — | — | **Drop** | Same answer as "Do you also have a personal policy?" Kept that one. |
| Room-rent limit | — | Keep | Drop | The most common reason a claim is paid short, and one tap. Company policies vary too much to ask here. |
| Main worry | **Drop** | — | — | Made the result vaguer, not sharper. |
| When cover should start | **Drop** | — | — | Now every person with no cover who asks for a call is treated as highest priority (P1). |
| Renewal window | — | Keep | — | Strongest buying signal. Decides call priority. |
| **NEW: monthly take-home income (band)** | Add | — | — | An advisor's first question. Sizes the cover and turns a hospital bill into "months of your income". "Prefer not to say" is allowed. |
| **NEW: where you live (metro / other)** | Add | — | — | Hospital costs differ a lot between metros and smaller cities. One tap instead of a pincode before the result. |

**Questions after the router:** A 3 (was 5) · B 4 (was 5, with fewer fields) · C 3 (was 5).
Every answer is one tap. Nothing is typed before the result. A single-question screen moves on by itself.

## 2. Result — one screen, no scroll, advisor voice

* **A — "The big picture":** the cover their life needs (e.g. ₹20 L = ₹10 L base + ₹10 L super top-up, plus a senior plan
  for parents). A bar chart shows what a ₹2 L / ₹5 L / ₹10 L hospital bill means in months of their income.
  One line on why now: waiting periods only start when you buy.
* **B / C — "You've done well, but…":** up to 2 wins as green chips. A gauge shows their cover against what we suggest,
  with the shortfall marked. Up to 3 gaps, each with a concrete rupee consequence, e.g. "A ₹20 L bill leaves ₹15 L for you to pay",
  or "Pick a room above the cap and a ₹3 L bill can be paid at half".
* **Tone:** urgent and concrete, never invented. Every rupee figure is either the person's own answer or a labelled
  example of how a rule works. IRDAI's advertising rules don't allow misleading or exaggerated claims, and a scare that turns
  out wrong loses the call.
* **Buttons:** "Fix this with an advisor" (main), "See plans that fit", "Send me this on WhatsApp", and a small
  "Full breakdown" link to the v2 detailed snapshot for people who want it.

## 3. What was missing in the funnel, and why it matters

| # | Gap | Proposal | Why it matters |
| --- | --- | --- | --- |
| 1 | People who stop half-way are lost | A WhatsApp nudge 2 hours after drop-off: "You were 2 taps away from your result" (resumes on the same link) | Partial answers are already saved. The cheapest recovery in the funnel. |
| 2 | Router misses "I have both" | Add "Both — my own and my company's" later; for now C asks about a personal policy | Many salaried people have both. Today they pick one and the advice is half right. |
| 3 | Progress says "Step 2 of 6" | Show "2 taps to your result" | The remaining effort is what keeps people going, not the step number. |
| 4 | No A/B measurement | Store the flow version on each quiz session | Proves whether v3 actually reduces drop-off. |
| 5 | Questions only in English | Translate the shorter quiz (≈40 strings) to Hindi and Marathi first | The biggest reach lever. v3 has half the copy to translate. |
| 6 | Income is personal | Optional "Prefer not to say", the reason shown on screen, used only to size cover | Trust. DPDP needs the purpose stated, and fewer people will lie. |
| 7 | Telecaller didn't see the advice | Lead card + sheet show suggested cover, shortfall and the gaps shown | The call opens on what the person already saw, not from zero. |
| 8 | No "not now" exit on the result | "Remind me in a week" (WhatsApp, with consent) | Captures people who are interested but busy, instead of losing them. |
| 9 | Unknown cover amount leads nowhere | "Not sure" on cover goes straight to "Read it from my policy" (upload) | Turns a dead end into Rung 2. |
| 10 | Calls for no-cover people had no priority signal | A + hand raised = P1 | No cover is the highest need, and we stopped asking about timing. |

Items 4, 7 and 10 are built in v3. The rest are listed for the roadmap.

## 4. VALIDATION REQUIRED

* **Cover rule** (`shared/src/advice.ts`): ₹10 L per adult, +₹5 L for a family, +₹5 L in a metro, +₹5 L if 41+, rounded to ₹5 L.
  A starting point for product/actuarial to tune.
* **Income bands** and the bill sizes used in the income chart (₹2 L / ₹5 L / ₹10 L) are illustrations, labelled as such.
* **Gap and consequence wording** needs compliance sign-off.
