import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPolicyFactsFromPages, positionedItemsToText } from '../src/integrations/extractor.js';

const fact = (facts: ReturnType<typeof extractPolicyFactsFromPages>, key: string) => facts.find(item => item.key === key);

test('extracts explicitly labelled facts with source page and conservative confidence', () => {
  const facts = extractPolicyFactsFromPages([{
    page: 2,
    text: [
      'Insurer: Acme Health Insurance',
      'Product Name: Family Secure Plus',
      'Policy Type: Family Floater',
      'Sum Insured: Rs. 5,00,000',
      'Policy Period: 01/04/2025 to 31/03/2026',
      'Co-payment: 10%',
      'Pre-existing diseases waiting period: 36 months',
      'Room Rent Limit: 1% of sum insured per day',
    ].join('\n'),
  }]);
  assert.equal(fact(facts, 'insurer_name')?.value, 'Acme Health Insurance');
  assert.equal(fact(facts, 'product_name')?.value, 'Family Secure Plus');
  assert.equal(fact(facts, 'policy_type')?.value, 'floater');
  assert.equal(fact(facts, 'sum_insured_inr')?.value, 500000);
  assert.equal(fact(facts, 'start_date')?.value, '2025-04-01');
  assert.equal(fact(facts, 'end_date')?.value, '2026-03-31');
  assert.equal(fact(facts, 'copay_percent')?.value, 10);
  assert.equal(fact(facts, 'ped_waiting_months')?.value, 36);
  assert.equal(fact(facts, 'room_rent_limit')?.sourcePage, 2);
  assert.ok((fact(facts, 'sum_insured_inr')?.confidence ?? 0) >= 0.8);
});

test('does not invent facts that are absent from the document', () => {
  const facts = extractPolicyFactsFromPages([{ page: 1, text: 'A health policy document with no structured policy details.' }]);
  for (const key of ['sum_insured_inr', 'members', 'copay_percent', 'ped_waiting_months']) {
    assert.equal(fact(facts, key)?.value, null, `${key} should remain unknown`);
    assert.equal(fact(facts, key)?.sourcePage, null);
    assert.equal(fact(facts, key)?.confidence, null);
  }
});

test('does not infer zero co-pay from a missing co-pay clause', () => {
  const facts = extractPolicyFactsFromPages([{ page: 3, text: 'Hospital expenses will be payable as per policy terms.' }]);
  assert.equal(fact(facts, 'copay_percent')?.value, null);
});


test('reconstructs separate PDF text lines in reading order', () => {
  const text = positionedItemsToText([
    { x: 10, y: 700, str: 'Sum Insured:' },
    { x: 100, y: 700, str: '₹5,00,000' },
    { x: 10, y: 680, str: 'Co-payment:' },
    { x: 100, y: 680, str: '10%' },
  ]);
  assert.equal(text, 'Sum Insured: ₹5,00,000\nCo-payment: 10%');
  const facts = extractPolicyFactsFromPages([{ page: 1, text }]);
  assert.equal(fact(facts, 'sum_insured_inr')?.value, 500000);
  assert.equal(fact(facts, 'copay_percent')?.value, 10);
});

test('rejects impossible calendar dates instead of normalising them', () => {
  const facts = extractPolicyFactsFromPages([{ page: 1, text: 'Policy Period: 31/02/2025 to 31/03/2026' }]);
  assert.equal(fact(facts, 'start_date')?.value, null);
  assert.equal(fact(facts, 'end_date')?.value, '2026-03-31');
});
