import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_TYPES, TURTLEMINT_PICKS, getApprovedTurtlemintPick } from './planCatalog.js';

describe('verified product pick guardrail', () => {
  it('does not expose named insurer products or prices until source evidence and approval are recorded', () => {
    for (const type of PLAN_TYPES) {
      const pick = getApprovedTurtlemintPick(type);
      assert.equal(pick.approvedForRecommendations, false);
      assert.equal(pick.insurer, null);
      assert.equal(pick.product, null);
      assert.equal(pick.startingPriceInr, null);
      assert.equal(TURTLEMINT_PICKS[type].approvedForRecommendations, false);
    }
  });
});
