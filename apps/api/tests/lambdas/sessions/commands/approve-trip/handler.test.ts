import { describe, expect, it } from 'vitest';
import { ApproveTripHandler } from '../../../../../src/lambdas/sessions/commands/approve-trip/handler.js';
import { InvalidTripStateError } from '../../../../../src/lambdas/sessions/domain/errors/errors.js';
import type { BookingSimulator } from '../../../../../src/lambdas/sessions/domain/ports/booking-simulator.js';
import { clock, InMemorySessionRepository, telemetry } from '../../fakes.js';

describe('ApproveTripHandler', () => {
  it('creates one explicitly simulated confirmation from awaiting approval', async () => {
    const repository = new InMemorySessionRepository();
    repository.metadata = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      status: 'AWAITING_APPROVAL',
      createdAt: 'x',
      updatedAt: 'x',
      version: 3,
    };
    repository.trip = {
      sessionId: repository.metadata.sessionId,
      status: 'AWAITING_APPROVAL',
      requirements: {},
    };
    const simulator: BookingSimulator = {
      simulate: async () => ({
        status: 'confirmed',
        simulation: true,
        confirmationId: 'DEMO-00000000',
        createdAt: '2026-08-10T12:00:00.000Z',
      }),
    };
    const result = await new ApproveTripHandler(
      repository,
      simulator,
      clock(),
      30,
      telemetry,
    ).execute('request-1', repository.metadata.sessionId);
    expect(result.booking).toEqual({
      status: 'confirmed',
      simulation: true,
      confirmationId: 'DEMO-00000000',
      createdAt: '2026-08-10T12:00:00.000Z',
    });
    expect(result.trip.status).toBe('SIMULATED_BOOKING_COMPLETE');
    expect(repository.metadata?.version).toBe(4);
  });
  it('does not simulate an invalid or duplicate approval', async () => {
    const repository = new InMemorySessionRepository();
    repository.metadata = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      status: 'SIMULATED_BOOKING_COMPLETE',
      createdAt: 'x',
      updatedAt: 'x',
      version: 3,
    };
    repository.trip = {
      sessionId: repository.metadata.sessionId,
      status: 'SIMULATED_BOOKING_COMPLETE',
      requirements: {},
    };
    let calls = 0;
    const simulator: BookingSimulator = {
      simulate: async () => {
        calls += 1;
        throw new Error('must not run');
      },
    };
    await expect(
      new ApproveTripHandler(repository, simulator, clock(), 30, telemetry).execute(
        'request-1',
        repository.metadata.sessionId,
      ),
    ).rejects.toBeInstanceOf(InvalidTripStateError);
    expect(calls).toBe(0);
  });
});
