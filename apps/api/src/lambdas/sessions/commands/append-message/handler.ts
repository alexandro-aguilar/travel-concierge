import { InvalidTripStateError, SessionNotFoundError } from '../../domain/errors/errors.js';
import type { Clock, IdGenerator, Telemetry } from '../../domain/ports/runtime.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';
import type { SessionMessage, Trip } from '../../domain/models/session.js';
import type { ConciergeWorkflow } from './concierge-workflow.js';

export class AppendMessageHandler {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly ttlDays: number,
    private readonly telemetry: Telemetry,
    private readonly workflow?: ConciergeWorkflow,
  ) {}

  public async execute(
    requestId: string,
    sessionId: string,
    content: string,
  ): Promise<{
    readonly sessionId: string;
    readonly message: SessionMessage;
    readonly trip: Trip;
    readonly assistantMessage?: SessionMessage;
    readonly status: string;
  }> {
    return this.telemetry.span('appendMessage', { requestId, sessionId }, async () => {
      const [metadata, trip] = await Promise.all([
        this.repository.getMetadata(sessionId),
        this.repository.getTrip(sessionId),
      ]);
      if (!metadata || !trip) throw new SessionNotFoundError();
      if (metadata.status !== 'COLLECTING_REQUIREMENTS') throw new InvalidTripStateError();
      const createdAt = this.clock.now().toISOString();
      const message: SessionMessage = {
        messageId: this.ids.uuid(),
        role: 'USER',
        content,
        createdAt,
      };
      const expiresAt = Math.floor(this.clock.now().getTime() / 1000) + this.ttlDays * 86400;
      const updated = await this.repository.appendMessage(
        sessionId,
        message,
        metadata.version,
        expiresAt,
      );
      if (!this.workflow) return { sessionId, message, trip, status: updated.status };
      const result = await this.workflow.run(content, trip.requirements);
      const assistantMessage: SessionMessage = {
        messageId: this.ids.uuid(),
        role: 'ASSISTANT',
        content: result.assistantMessage,
        createdAt: this.clock.now().toISOString(),
      };
      const finalTrip: Trip = { ...result.trip, sessionId };
      const finalMetadata = await this.repository.updateTripAndAppendMessage(
        sessionId,
        finalTrip,
        assistantMessage,
        updated.version,
        expiresAt,
      );
      return {
        sessionId,
        message,
        assistantMessage,
        trip: finalTrip,
        status: finalMetadata.status,
      };
    });
  }
}
