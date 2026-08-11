import { SessionNotFoundError } from '../../domain/errors/errors.js';
import type { Telemetry } from '../../domain/ports/runtime.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';
import type { Trip } from '../../domain/models/session.js';

export class GetTripHandler {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly telemetry: Telemetry,
  ) {}
  public async execute(requestId: string, sessionId: string): Promise<Trip> {
    return this.telemetry.span('getTrip', { requestId, sessionId }, async () => {
      const trip = await this.repository.getTrip(sessionId);
      if (!trip) throw new SessionNotFoundError();
      return trip;
    });
  }
}
