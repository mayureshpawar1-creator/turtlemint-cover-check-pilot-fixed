import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSUMPTIONS, CLAIMS_EVIDENCE, COST_EVIDENCE, coverScenarios, SCENARIO_CAVEAT, type Scenario, type ScenarioId } from './coverScenarios';
import { SOURCES } from './benchmarks';

const byId = (city: 'metro' | 'other' | 'unknown', n = 4) =>
  Object.fromEntries(coverScenarios({ insuredCount: n, city }).map((s) => [s.id, s])) as Record<ScenarioId, Scenario>;

test('every evidence figure points at a registered source', () => {
  assert.ok(CLAIMS_EVIDENCE.source in SOURCES);
  for (const [key, e] of Object.entries(COST_EVIDENCE)) assert.ok(e.source in SOURCES, `${key} → ${e.source}`);
});

test('metro amounts match the worked example in SUM_INSURED_METHOD.md', () => {
  const s = byId('metro');
  assert.equal(s.essential.amountInr, 550_000);
  assert.equal(s.balanced.amountInr, 1_250_000);
  assert.equal(s.higher.amountInr, 1_600_000);
  assert.deepEqual(s.balanced.rangeInr, { low: 1_250_000, high: 1_350_000 });
});

test('other-city amounts match the worked example', () => {
  const s = byId('other');
  assert.equal(s.essential.amountInr, 350_000);
  assert.equal(s.balanced.amountInr, 950_000);
  assert.equal(s.higher.amountInr, 1_200_000);
});

test('unknown city is treated like metro (the more conservative amounts)', () => {
  assert.deepEqual(byId('unknown'), byId('metro'));
});

test('scenarios are ordered and never below the government-rate floor', () => {
  for (const city of ['metro', 'other'] as const) {
    const s = byId(city);
    assert.ok(s.essential.amountInr <= s.balanced.amountInr && s.balanced.amountInr <= s.higher.amountInr);
    const floor = COST_EVIDENCE.cghsCabgSuperSpecialityTier1Inr.value * COST_EVIDENCE.cghsTierFactor.value[city];
    assert.ok(s.essential.amountInr >= floor);
  }
});

test('metro amounts are at least the other-city amounts', () => {
  const m = byId('metro'), o = byId('other');
  for (const id of ['essential', 'balanced', 'higher'] as const) assert.ok(m[id].amountInr >= o[id].amountInr);
});

test('results are rounded up and the range brackets the central value', () => {
  for (const s of coverScenarios({ insuredCount: 2, city: 'metro' })) {
    assert.equal(s.amountInr % ASSUMPTIONS.roundUpToInr, 0);
    assert.ok(s.rangeInr.low <= s.amountInr && s.amountInr <= s.rangeInr.high);
  }
});

test('income is not an input to how much cover is needed', () => {
  const keys = Object.keys({ insuredCount: 1, city: 'metro' } satisfies Parameters<typeof coverScenarios>[0]);
  assert.ok(!keys.some((k) => /income/i.test(k)));
});

test('the caveat says the amounts come from customers’ bills and one bill can be larger', () => {
  assert.match(SCENARIO_CAVEAT, /Turtlemint customers/);
  assert.match(SCENARIO_CAVEAT, /can be larger/);
});
