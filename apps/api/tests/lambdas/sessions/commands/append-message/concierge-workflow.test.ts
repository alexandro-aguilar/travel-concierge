import { describe, expect, it } from 'vitest';
import { ConciergeWorkflow } from '../../../../../src/lambdas/sessions/commands/append-message/concierge-workflow.js';
import {
  MockEventSearch,
  MockFlightSearch,
  MockHotelSearch,
  MockWeatherSearch,
  RuleBasedConciergeModel,
} from '../../../../../src/lambdas/sessions/infrastructure/providers/mock-providers.js';
describe('ConciergeWorkflow', () => {
  it('collects incomplete requirements without searching', async () => {
    const result = await new ConciergeWorkflow(
      new RuleBasedConciergeModel(),
      new MockFlightSearch(),
      new MockHotelSearch(),
      new MockEventSearch(),
      new MockWeatherSearch(),
    ).run('I want to go somewhere', {});
    expect(result.trip.status).toBe('COLLECTING_REQUIREMENTS');
  });
  it('produces a deterministic recommendation for complete requirements', async () => {
    const result = await new ConciergeWorkflow(
      new RuleBasedConciergeModel(),
      new MockFlightSearch(),
      new MockHotelSearch(),
      new MockEventSearch(),
      new MockWeatherSearch(),
    ).run(
      'from Mexico City to London from 2026-09-12 to 2026-09-18 for 2 people budget 1000 USD direct',
      {},
    );
    expect(result.trip.status).toBe('RECOMMENDATION_READY');
    expect(result.trip.recommendation?.total.amount).toBe(700);
  });
});
