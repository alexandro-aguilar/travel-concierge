import { describe, expect, it } from 'vitest';
import {
  StructuredTelemetry,
  sanitizeTelemetryFields,
} from '../../../../src/lambdas/sessions/telemetry/telemetry.js';

describe('StructuredTelemetry', () => {
  it('redacts sensitive and unrestricted fields before emitting a correlated log', async () => {
    expect(
      sanitizeTelemetryFields({
        requestId: 'request-1',
        sessionId: 'session-1',
        authorization: 'Bearer secret',
        message: 'private itinerary',
        providerPayload: { raw: true },
        retryCount: 2,
      }),
    ).toEqual({ requestId: 'request-1', sessionId: 'session-1', retryCount: 2 });
    await expect(
      new StructuredTelemetry().span(
        'booking.simulation',
        { requestId: 'request-1', sessionId: 'session-1' },
        async () => undefined,
      ),
    ).resolves.toBeUndefined();
  });
});
