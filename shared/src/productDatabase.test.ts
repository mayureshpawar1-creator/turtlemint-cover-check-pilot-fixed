import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REAL_INSURANCE_PRODUCTS, getProductsByTypeAndCoverage, getProductsByValue } from './productDatabase.js';

describe('production product catalogue guardrail', () => {
  it('does not expose unverified sample product records as live recommendations', () => {
    assert.deepEqual(REAL_INSURANCE_PRODUCTS, []);
    assert.deepEqual(getProductsByTypeAndCoverage('family_floater', 5), []);
    assert.deepEqual(getProductsByValue('family_floater', 5, 100_000), []);
  });
});
