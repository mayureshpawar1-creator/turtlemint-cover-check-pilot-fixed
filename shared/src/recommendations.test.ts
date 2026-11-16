import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendPlans } from './recommendations';
import { type QuizAnswers } from './types';

// Test cases for different personas
const testCases: Array<{
  name: string;
  answers: QuizAnswers;
  expectedPersonaId: string;
  minRecommendations: number;
}> = [
  {
    name: 'Senior person (61+)',
    answers: {
      situation: 'none',
      members: ['self'],
      age_band: '61p',
      premium_comfort: '20_35k',
      city_tier: 'other'
    },
    expectedPersonaId: 'senior',
    minRecommendations: 1
  },
  {
    name: 'Pre-retirement with dependents',
    answers: {
      situation: 'none',
      members: ['self', 'spouse', 'children'],
      age_band: '51_60',
      premium_comfort: '20_35k',
      city_tier: 'metro'
    },
    expectedPersonaId: 'pre_retire',
    minRecommendations: 1
  },
  {
    name: 'Sandwich generation (kids and parents)',
    answers: {
      situation: 'none',
      members: ['self', 'spouse', 'children', 'parents'],
      age_band: '41_50',
      parents_age_band: '70p',
      premium_comfort: '20_35k',
      city_tier: 'metro'
    },
    expectedPersonaId: 'sandwich',
    minRecommendations: 1
  },
  {
    name: 'Young family',
    answers: {
      situation: 'none',
      members: ['self', 'spouse', 'children'],
      age_band: '31_40',
      premium_comfort: '20_35k',
      city_tier: 'other'
    },
    expectedPersonaId: 'family',
    minRecommendations: 1
  },
  {
    name: 'Young adult starting out',
    answers: {
      situation: 'none',
      members: ['self'],
      age_band: '18_30',
      premium_comfort: '20_35k',
      city_tier: 'other'
    },
    expectedPersonaId: 'starter',
    minRecommendations: 1
  }
];

describe('Persona-based recommendation engine', () => {
  for (const testCase of testCases) {
    describe(testCase.name, () => {
      it(`should return recommendations for ${testCase.expectedPersonaId} persona`, () => {
        const recommendations = recommendPlans(testCase.answers);

        // Should return at least the minimum number of recommendations
        assert.ok(recommendations.length >= testCase.minRecommendations);

        // All recommendations should be PlanRec objects
        for (const rec of recommendations) {
          assert.ok('type' in rec);
          assert.ok('title' in rec);
          assert.ok('why' in rec);
          assert.ok('points' in rec);
          assert.ok('cta' in rec);
          assert.ok('url' in rec);
          assert.ok('reason' in rec);
        }
      });

      it(`should have reasonable justification text`, () => {
        const recommendations = recommendPlans(testCase.answers);

        for (const rec of recommendations) {
          // Justification should be a non-empty string
          assert.ok(typeof rec.why === 'string' && rec.why.length > 0);

          // Points should be an array of strings
          assert.ok(Array.isArray(rec.points));

          // Each point should be a non-empty string
          for (const point of rec.points) {
            assert.ok(typeof point === 'string' && point.length > 0);
          }
        }
      });
    });
  }

  describe('Edge cases', () => {
    it('should handle missing quiz answers gracefully', () => {
      const minimalAnswers: QuizAnswers = {}; // Empty answers
      const recommendations = recommendPlans(minimalAnswers);

      // v5: with nothing known the board asks to read their policy first — no plan is pushed
      assert.ok(Array.isArray(recommendations));
      assert.ok(!recommendations.some((r) => r.type === 'term_life' || r.type === 'critical_illness'));

      // Should still have valid PlanRec structure
      for (const rec of recommendations) {
        assert.ok('type' in rec);
        assert.ok('title' in rec);
        assert.ok('why' in rec);
        assert.ok('points' in rec);
        assert.ok('cta' in rec);
        assert.ok('url' in rec);
        assert.ok('reason' in rec);
      }
    });
  });
});