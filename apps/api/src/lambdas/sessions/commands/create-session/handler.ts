import type { Clock, IdGenerator, Telemetry } from '../../domain/ports/runtime.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';
import type { SessionMetadata, Trip } from '../../domain/models/session.js';

export class CreateSessionHandler {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly ttlDays: number,
    private readonly telemetry: Telemetry,
  ) {}

  public async execute(
    requestId: string,
  ): Promise<Pick<SessionMetadata, 'sessionId' | 'status' | 'createdAt'>> {
    return this.telemetry.span('createSession', { requestId }, async () => {
      const sessionId = this.ids.uuid();
      const createdAt = this.clock.now().toISOString();
      const metadata: SessionMetadata = {
        sessionId,
        status: 'COLLECTING_REQUIREMENTS',
        createdAt,
        updatedAt: createdAt,
        version: 1,
      };
      const trip: Trip = { sessionId, status: metadata.status, requirements: {} };
      const expiresAt = Math.floor(this.clock.now().getTime() / 1000) + this.ttlDays * 86400;
      await this.repository.create({ metadata, trip, expiresAt });
      return { sessionId, status: metadata.status, createdAt };
    });
  }
}
