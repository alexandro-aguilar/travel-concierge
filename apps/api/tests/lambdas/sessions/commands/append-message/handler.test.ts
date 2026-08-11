import { describe, expect, it } from 'vitest';
import { AppendMessageHandler } from '../../../../../src/lambdas/sessions/commands/append-message/handler.js';
import { CreateSessionHandler } from '../../../../../src/lambdas/sessions/commands/create-session/handler.js';
import { InvalidTripStateError } from '../../../../../src/lambdas/sessions/domain/errors/errors.js';
import { clock, ids, InMemorySessionRepository, telemetry } from '../../fakes.js';

describe('AppendMessageHandler', () => {
  it('adds a message while requirements are being collected', async () => {
    const repository = new InMemorySessionRepository();
    const idGenerator = ids(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    );
    const session = await new CreateSessionHandler(
      repository,
      clock(),
      idGenerator,
      30,
      telemetry,
    ).execute('r');
    const result = await new AppendMessageHandler(
      repository,
      clock(),
      idGenerator,
      30,
      telemetry,
    ).execute('r', session.sessionId, 'Hello');
    expect(result.message.content).toBe('Hello');
    expect(repository.metadata?.version).toBe(2);
  });
  it('rejects a message after the workflow leaves collecting requirements', async () => {
    const repository = new InMemorySessionRepository();
    repository.metadata = {
      sessionId: '00000000-0000-4000-8000-000000000001',
      status: 'SEARCHING',
      createdAt: 'x',
      updatedAt: 'x',
      version: 1,
    };
    repository.trip = {
      sessionId: repository.metadata.sessionId,
      status: 'SEARCHING',
      requirements: {},
    };
    await expect(
      new AppendMessageHandler(repository, clock(), ids(), 30, telemetry).execute(
        'r',
        repository.metadata.sessionId,
        'Hello',
      ),
    ).rejects.toBeInstanceOf(InvalidTripStateError);
  });
});
