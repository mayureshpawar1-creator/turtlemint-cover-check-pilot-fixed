# Cover Check v4 — one screen in, one screen out

> **v5 update:** the result is now written for the person (9 life-stage personas × their cover today) and the upload
> result is a one-screen board too. See [PERSONAS.md](PERSONAS.md).

**Feedback (leadership):** onboarding still felt like many steps, and each extra tap risks losing the person. The result had too
much content, swiping and scrolling. People should get the answer fast and then talk to an advisor.

**Principle:** after the landing, the person never leaves a screen until they have their plan. One screen to answer, one screen
to see the plan, and one button to act on it. The landing stays: it states the promise and the privacy line, and its button
("Get my cover plan", was "Start the quiz") opens the one-screen check.

```
WhatsApp button ─▶ [ S0 landing ] ─"Get my cover plan"─▶ [ S1 one-screen check ] ─▶ [ S7 your cover plan ] ─▶ Talk to my advisor (S8 → S9)
                    promise + privacy         5 cards, about 20 seconds      4 blocks, no scroll      └─ every plan: details in a bottom sheet
                    or "Upload it" ─▶ U1–U8 (unchanged)
```

## 1. Onboarding — one screen, cards like a travel search

The reference was Airbnb's search ("Where · When · Who"). The cards are stacked, and only one is open at a time.
A closed card is a single row that shows the answer on the right. When a tap completes a card, it closes and the next
one opens. Nothing is typed. The family question uses steppers. The button says **Next** until every card is answered,
then **See my cover plan**. **Clear all** resets everything.

| Card | Asks | Input | Why it stays |
| --- | --- | --- | --- |
| Cover | None yet · My own · Company · Company + own, then the amount if they have cover | 4 tiles, then amount chips (the choice folds into a pill) | The only router. "Company + own" removes v3's separate "personal policy too?" question. |
| Who | Adults (1–2) · Children (0–4) · Parents (0–4) | Steppers, which start at "Just you" | Floater vs individual, separate parents' plan, and whether anyone depends on their income (term). |
| Age | 18–30 … 61+ | Chips | Premiums, health need, term multiple, no term at 61+. |
| Income | Monthly take-home, or "Rather not say" | Chips | Now needed by everyone: it sizes term and crisis cover. Without it, those blocks say "On your call". |
| Where | Metro · Other city | 2 tiles | Hospital costs. |

**Dropped from v3:** the parents' age band (parents get their own plan unless we know they're under 60), the room-rent
limit, the renewal window, and "family in company cover". Each changed one line of advice but cost a screen. The advisor
asks about them, and a policy upload reads them exactly.

**Taps to a result:** no cover with a family of 4 takes 8 taps (1 + 3 steppers + Next + 3). Own policy, just you, takes 6.
In v3 it was 4–5 screens with a Continue button on most.

## 2. Result — "Your cover plan", one screen in blocks

Laid out like an advisor's board (see the reference): what you need, Turtlemint's pick, and what to do.

| Block | Shows | Rule |
| --- | --- | --- |
| Hero | "Priya, here's your cover plan" plus their profile in one line | — |
| Health insurance | Cover you need (₹20 L), a have-vs-need bar, and the single most urgent risk in red | `suggestedCoverLakh` (advice.ts) |
| Turtlemint pick | The plan type (or Turtlemint's named product), the amount, 2 short ticks, "+ Plan for your parents" | Path rules (planBoard.ts) |
| Term insurance | Cover you need (₹1.25 Cr), till age 60 | 15× yearly income (≤40), 12× (41–50), 10× (51–60), none at 61+ |
| Crisis cover | Cover you need (₹25 L) for cancer, heart attack and stroke | 3 years of income, ₹10 L–₹1 Cr |

* **See plan details** on any block opens a **bottom sheet** over the board, never a new page. It shows what the plan is,
  why it suits them, 3 facts, the price (once Turtlemint enters one), **Talk to advisor about this** and **View on Turtlemint**.
* **Talk to my advisor — free** is the only primary action. Below it are the next live call slot and "Send to WhatsApp".
* Removed: the swipeable full report (S7d), the risk tiles, the bill-split bar and the charts. Leadership asked for less to read.

**Price slot.** `TURTLEMINT_PICKS` in `shared/src/planCatalog.ts` holds Turtlemint's pick per plan type: insurer, product,
starting price, who the price is for, and the product URL. While a price is empty, the block says "See plan details" and the
sheet says "Your advisor gets you the exact quote". We never show an estimate.

**VALIDATION REQUIRED before go-live:** the term multiples, the crisis rule (3 years of income), the health cover rule, and the
plan wording. These are stated rules, not market data. Turtlemint's advisory team should confirm or tune them in `planBoard.ts`.

## 3. Fit

Verified with Playwright for all three paths, at every card state, on the result and on the plan sheet:
**390×690 fits with no scroll in every state.** On small phones (360×640) a compact mode hides the title and secondary labels,
and everything still fits.

## 4. What to measure (migration 006)

* `card_answered` event per card, with seconds spent → view `card_dropoff` (which card people stop at).
* `plan_details_opened` (which block they tapped) → `recommendation_clicked` (Turtlemint page or advisor).
* `quiz_session.flow_version = 'v4'` → compare with v3 in `dropoff_by_version`.
