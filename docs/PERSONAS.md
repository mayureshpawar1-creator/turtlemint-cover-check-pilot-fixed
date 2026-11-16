# Cover Check v5 — advice that fits the person

The same five answers describe very different lives. A 26-year-old on their own, a couple planning a baby, a family
looking after kids and parents, someone five years from retirement: each of them should feel *"Turtlemint understood
my situation"*, not that they got a template.

Three rules run through everything:

1. **Their life first.** The opening line, the order of what to do, and every "For you" line come from who they are.
2. **Honest, even when it doesn't sell.** If they don't need something, we show it greyed out with the reason
   ("Later", "Not for you"). If their cover is enough, the advice is **Keep your plan**. If they don't know what they
   have, we ask to read the policy **before** suggesting anything.
3. **One screen.** Personalisation shows up as the opening line, priority chips and the "For you" lines. It never adds
   more blocks to read. Details live in bottom sheets.

## 1. Who they are (life stage → persona)

Personas are checked in this order. `shared/src/persona.ts`

| Persona | How we know | Opening (no cover yet) | Term | Crisis |
| --- | --- | --- | --- | --- |
| Cover for your later years | Age 61+ | "Cover built for 60+": senior plan, clear co-pay; free ₹5 L Ayushman Vay Vandana at 70+ | **Not for you**: rarely worth it after 60 | Good to have (entry-age limits apply) |
| Planning for retirement | Age 51–60 | "Make cover outlast your job": work cover ends at retirement, buying after 60 costs more | Good to have if someone depends on them, otherwise **Not for you** (few years left to 60) | **Must have** |
| Caring for two generations | Kids **and** parents | "Two generations, two plans": parents' claims won't eat into the kids' cover | **Must have** | Good to have |
| Your 40s / A family in its busiest years | Age 41–50 | "Bigger cover for your 40s": serious illness gets more common | Must have if someone depends on them, otherwise **Later** | **Must have** |
| A growing family | Kids | "Protect your kids' future": health cover pays the hospital, term keeps their life on track | **Must have** | Good to have |
| Looking after your parents | Parents, no kids | "A plan for your parents too": keep their age off your premium | **Must have** | Good to have |
| Building a life together | Partner, no kids | "One plan for both of you": planning a baby? buy first, because maternity cover has a waiting period | Good to have | Good to have |
| Just starting out | 18–30, on their own | "Start cheap, start now": lowest premiums, waiting periods start the day you buy | **Later**: when you marry, have a child or take a home loan | Good to have |
| Covering yourself | 31–40, on their own | "Keep bills off your savings": health first, crisis next, no term yet | **Later** | Good to have |

## 2. Their cover today (shapes the opening and the advice)

| Situation | Opening | Health advice |
| --- | --- | --- |
| No cover | The persona's opening | Family floater (2+ people), personal plan, or senior plan (61+ on their own) for the full amount they need |
| Company cover only | "Your cover is tied to your job" | A personal plan that stays when the job doesn't; keep the company cover as an extra |
| Own (or company + own), short | "Good start — ₹X L to go" | **Super top-up** for the gap. It keeps the waiting time they've already served |
| Own, enough | "Your health cover looks good" | **Keep your plan**: "We won't sell you more." Review at renewal |
| Not sure of the amount | "First, let's see what you have" | **Check your policy first**, which goes straight to upload. No health plan is suggested blind |

Parents (any persona) add **+ Plan for your parents**: a separate senior plan, plus the free Ayushman Vay Vandana
cover at 70+.

## 3. What an advisor would add (the "Good to know" lines in the plan sheet)

| When | They read |
| --- | --- |
| Take-home ₹1 L+ | Pick a plan with no room-rent cap |
| Take-home under ₹50k and need over ₹10 L | A ₹10 L base plus a super top-up is usually the cheapest way to get there |
| Take-home under ₹25k | Check if the family qualifies for Ayushman Bharat PM-JAY (free ₹5 L a year) |
| Metro / other city | Sized for a metro hospital / costs are lower, so the cover goes further |
| Couple | Compare maternity cover and its waiting period before buying |
| 41–60 | A routine health check-up before cover starts is normal |
| 61+ | Watch co-pay; by IRDAI rules, the wait for existing illnesses is at most 3 years |
| Someone depends on them (term) | Add any home or car loan left to the term cover |
| Crisis cover | It pays even when health cover pays the hospital: use it for EMIs, rent, recovery |

## 4. The upload result: "Your policy, understood"

The upload result is one screen, built the same way as the quiz result. `shared/src/policyBoard.ts`

* **Opening:** a verdict in one line. "A good base — ₹15 L short", "A strong policy — keep it" or "Enough cover — one thing to fix",
  plus what it means for their family ("4 of you share one ₹5 L…").
* **Your cover:** cover vs what they need, shared by how many people.
* **Our advice, in their interest:**
  - Short → a **super top-up**, which keeps the months of waiting they've served (a new policy would restart it).
  - Enough but capped → **fix the room-rent cap at renewal**.
  - Enough but co-pay → compare plans without co-pay.
  - Nothing wrong → **Keep this policy**: "We won't sell you something you don't need."
* **Inside your policy:** four checks, always in the same place:
  - room rent
  - existing illnesses
  - co-pay
  - renewal

  Each one opens plain words, **What we'd do**, and the page it was read from. The waiting-period check explains
  **portability** (the new insurer must credit the waiting already served).
* **Whole policy:** every line with its page number, in a sheet.
* The family is read from the policy (self, spouse, kids, parents). The persona uses the **policyholder's** age, not a parent's.

## 5. Sources for the facts we state

* Ayushman Vay Vandana: free ₹5 L a year for everyone 70+, whatever their income ([PIB, Dec 2024](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2082288)).
* Portability: the new insurer must credit the waiting already served ([IRDAI policyholder portal](https://policyholder.gov.in/portability-of-health-insurance)).
* The wait for existing illnesses is at most 36 months (IRDAI Master Circular, May 2024).
* Medical inflation is about 13% a year (Milliman).
* The cover, term (15× / 12× / 10× yearly income) and crisis (3 years of income) amounts are **our stated rules** — **VALIDATION REQUIRED** by Turtlemint's advisory team.

## 6. What the telecaller sees

The lead card's advice line now starts with the persona and repeats exactly what the person saw, for example:
"A growing family · Health ₹20 L (has none) · Pick: Family floater ₹20 L · Term ₹1.25 Cr · Crisis ₹25 L · Every hospital bill is yours today"
The advisor opens the call on the same page as the customer.
