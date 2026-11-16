import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProductEvidenceFromPages, positionedProductItemsToText } from '../src/integrations/productDocumentReader.js';

test('discovers page-backed evidence snippets without assigning normalized policy values', () => {
  const candidates = extractProductEvidenceFromPages([{
    page: 7,
    text: [
      'Room rent: eligible room category is described below.',
      'A co-payment of 20% applies in the circumstances stated in this clause.',
      'Pre-existing diseases are subject to the waiting period stated in the schedule.',
      'This benefit is not covered under the policy.',
      'Restore benefit: see the restoration section.',
      'Optional covers may be selected at inception.',
    ].join('\n'),
  }]);

  assert.ok(candidates.some(item => item.factKey === 'room_rent' && item.sourcePage === 7));
  assert.ok(candidates.some(item => item.factKey === 'copay' && item.evidenceText.includes('20%')));
  assert.ok(candidates.some(item => item.factKey === 'waiting_period_pre_existing'));
  assert.ok(candidates.some(item => item.factKey === 'exclusions'));
  assert.ok(candidates.some(item => item.factKey === 'restoration'));
  assert.ok(candidates.some(item => item.factKey === 'add_ons'));
  assert.ok(candidates.every(item => item.sourcePage > 0 && item.evidenceText.length > 0));
});

test('does not invent evidence when a page has no supported topic phrase', () => {
  assert.deepEqual(
    extractProductEvidenceFromPages([{ page: 1, text: 'This page contains general introductory wording only.' }]),
    [],
  );
});

test('reconstructs PDF text items in reading order and retains line boundaries', () => {
  const text = positionedProductItemsToText([
    { x: 10, y: 700, str: 'Room rent:' },
    { x: 110, y: 700, str: 'Single private room' },
    { x: 10, y: 680, str: 'Co-payment:' },
    { x: 110, y: 680, str: '10%' },
  ]);
  assert.equal(text, 'Room rent: Single private room\nCo-payment: 10%');
  const candidates = extractProductEvidenceFromPages([{ page: 3, text }]);
  assert.equal(candidates.find(item => item.factKey === 'room_rent')?.sourcePage, 3);
  assert.ok(candidates.some(item => item.factKey === 'copay'));
});

test('caps evidence candidates per topic and overall to prevent oversized writes', () => {
  const text = Array.from({ length: 80 }, (_, i) => `Room rent clause ${i + 1}: the eligible room category is stated here.`).join('\n');
  const candidates = extractProductEvidenceFromPages([{ page: 1, text }]);
  assert.equal(candidates.filter(item => item.factKey === 'room_rent').length, 30);
});
