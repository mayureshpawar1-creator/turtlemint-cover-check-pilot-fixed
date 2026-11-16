# Cover Check — everything we capture (v4)

Every value below is stored in PostgreSQL (`cover_check` schema). "Shown to telecaller" means it appears on the lead card
and in the telecaller sheet (`npm run export:leads`).

## By screen

| Screen | What the person does | Stored in | Event(s) | Shown to telecaller |
| --- | --- | --- | --- | --- |
| WhatsApp button | Taps the link | `source` (template, message id, door, campaign, creative, UTM, device) | `link_clicked` | — |
| S0 Landing | Sees the promise, taps "Get my cover plan" | — | `landing_viewed`, `screen_viewed` | — |
| S1 One-screen check (v4) | Each card answered | — (held on the device until "See my cover plan") | `screen_viewed`, `card_answered` (card, seconds) | — |
| S1 "See my cover plan" | Submits the one screen | `quiz_session` (flow_version v4), `consent` (save_answers), `quiz_answer` (situation, personal policy, amount, `adults_count`, `children_count`, `parents_count`, derived `members`, age band, income band, city), `quiz_answer_meta` | `quiz_started`, `answer_submitted`, `quiz_completed`, `readout_viewed` | Situation + family + answers |
| S7 Your cover plan (v5, one screen) | Sees their persona's plan: health need vs have, our advice (plan / keep / check first), term and crisis with Must have · Good to have · Later · Not for you | `recommendation` (exactly the picks on the board: health, parents, term, crisis; reason, URL with UTM), `finding` (rule lines shown) | `snapshot_viewed` (persona, need, have, advice kind, term + crisis priority, picks), `recommendation_shown` | Advice shown: "Health ₹20 L (has ₹5 L, short ₹15 L) · Pick · Term · Crisis · risk" |
| S7 See plan details | Opens a plan's bottom sheet | — | `plan_details_opened` (type) | — |
| S7 sheet | "View on Turtlemint" / "Talk to advisor about this" | `recommendation.clicked_ts` / `advisor_requested_ts`; call note pre-filled "About: Term insurance" | `recommendation_clicked` | Plans explored, note |
| S7 Checklist | Ticks "I've checked this" | `checklist_mark` (item, status shown, ticked, time) | `checklist_marked` | Still to check (and which they ticked) |
| S8 Save | Name, pincode, number, language | `lead` (first_name, pincode, city, state, mobile_confirmed, language) | `capture_submitted` | Name, where |
| S9 What next | Picks an option | `handoff` (action) | `next_action_selected` | Asked for |
| S9 Advisor | Slot, language, topic, note, tick, OTP | `handoff` (slot, language, topic, note, priority, queue, SLA), `consent` (contact_call), `otp_challenge` | `otp_sent`, `otp_verified`, `call_requested` | Asked for, priority, consent |
| S9a Plans that fit | Sees plan types | `recommendation` (plan type, reason, rank, URL with UTM) | `recommendation_shown` | Plans they explored |
| S9a / U7 | Opens a Turtlemint page | `recommendation.clicked_ts`, `click_count` | `recommendation_clicked` (target turtlemint) | "(opened on Turtlemint)" |
| S9a / U7 | "Talk to an advisor about this" | `recommendation.advisor_requested_ts`; call note pre-filled | `recommendation_clicked` (target advisor) | Note: "About: …" |
| S9b Preview | Sees the exact message | — | `summary_previewed` | — |
| S9b Send | Sends to WhatsApp (+ optional contact tick) | `consent` (whatsapp_summary), `whatsapp_message` (message id, body hash, previewed time), `handoff` (summary_only) | `summary_sent` | Warm lead if ticked |
| S10 | Withdraws | `consent` withdrawal rows, `lead.do_not_contact` | `consent_withdrawn` | Removed from every sheet |
| U1–U5 Upload | Consent, OTP, files, confirm facts | `consent` (read_document), `policy_document`, `policy_fact` (value, page, confidence, user edit), `document_access_log` | `upload_*`, `extraction_ready`, `facts_confirmed` | Policy upload |
| U6 Your policy, understood (v5, one screen) | Sees the verdict, cover vs need, our advice and 4 checks | `finding` (D1–D5), `recommendation` (origin document — only when we suggest a plan; none when the advice is "keep it") | `policy_health_viewed` (persona, % covered, advice kind, each check's status) | Plans explored |
| U6 check / whole policy | Opens a check (plain words + what to do + page) or the whole policy | — | `point_opened` (area, or about + target advisor) | — |
| Telecaller | Logs the call | `call_outcome` (attempt, connected, minutes, disposition, enquiry id, notes) | — | — |

## Analytics views

| View | Answers |
| --- | --- |
| `funnel_daily` | Clicks → landing → quiz → readout → capture → call / upload / summary, per day and door |
| `screen_dropoff` | Where unfinished quizzes stopped |
| `dropoff_by_version` | v2 vs v3: where people stop, and time to result |
| `quiz_timing` | Is it really ~60 seconds (p50 / p90 per path) |
| `recommendation_funnel` | Per plan type and reason: shown → opened on Turtlemint → advisor requested |
| `agent_queue` | Who may be called right now (consent live, not DND) |

## Where the benchmark numbers come from

`shared/src/benchmarks.ts` — every figure shown on S7 and U7 lives there with its source, and each chart shows its source line.

| Figure | Value | Source |
| --- | --- | --- |
| Insured lives by channel | 58.06 crore: 42.3% government, 47.4% group, 10.3% individual | IRDAI Annual Report 2024-25 (verify against the lives-covered table) |
| Suggested cover | Per person (family, age, city, income) | Cover Check rule, `shared/src/advice.ts` — not an external figure |
| Average cover bought via Turtlemint | Empty until filled | Turtlemint's own data (`FIRST_PARTY` in benchmarks.ts). Hidden until filled |
| People with no health financial protection | 40 crore, at least 30% | NITI Aayog, Missing Middle (2021) |
| Medical inflation | 12% (2024), 13% projected (2025) | Milliman (Apr 2026) |
| Waiting period cap, moratorium | 36 months; 5 years | IRDAI Master Circular on Health Insurance, 29 May 2024 |
| Average settled claim, cashless share | ₹28,910; 58% | IRDAI Annual Report 2024-25 |

Update the values in that one file when a new edition is published. Compliance should approve the wording before launch.

**Source rule:** regulator, government and actuarial sources only, plus Turtlemint's own data. Never a competitor (aggregators, brokers, other distributors), as a source or as a link. A test enforces this.
