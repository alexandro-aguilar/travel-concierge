import { describe, expect, it } from 'vitest';
import { DeterministicBookingSimulator } from '../../../../../src/lambdas/sessions/infrastructure/booking/deterministic-booking-simulator.js';
import { clock, ids } from '../../fakes.js';

describe('DeterministicBookingSimulator', () => {
  it('creates a clearly marked demo confirmation without provider access', async () => {
    const result = await new DeterministicBookingSimulator(
      clock(),
      ids('00000000-0000-4000-8000-000000000001'),
    ).simulate({ sessionId: 's', status: 'AWAITING_APPROVAL', requirements: {} });
    expect(result).toEqual({
      status: 'confirmed',
      simulation: true,
      confirmationId: 'DEMO-000000000000',
      createdAt: '2026-08-10T12:00:00.000Z',
    });
  });
});
