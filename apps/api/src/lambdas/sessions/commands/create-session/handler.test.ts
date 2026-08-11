import { describe, expect, it } from 'vitest';
import { CreateSessionHandler } from './handler.js';
import { clock, ids, InMemorySessionRepository, telemetry } from '../../tests/fakes.js';

describe('CreateSessionHandler', () => {
  it('creates an empty collecting-requirements session with a 30-day TTL', async () => {
    const repository = new InMemorySessionRepository();
    const result = await new CreateSessionHandler(repository, clock(), ids('00000000-0000-4000-8000-000000000001'), 30, telemetry).execute('request-1');
    expect(result).toEqual({ sessionId: '00000000-0000-4000-8000-000000000001', status: 'COLLECTING_REQUIREMENTS', createdAt: '2026-08-10T12:00:00.000Z' });
    expect(repository.trip).toEqual({ sessionId: result.sessionId, status: 'COLLECTING_REQUIREMENTS', requirements: {} });
  });
});
