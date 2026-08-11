import { SessionNotFoundError } from '../../domain/errors/errors.js';
import type { Telemetry } from '../../domain/ports/runtime.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';

export class GetSessionHandler {
  public constructor(private readonly repository: SessionRepository, private readonly telemetry: Telemetry) {}
  public async execute(requestId: string, sessionId: string, cursor?: string): Promise<object> {
    return this.telemetry.span('getSession', { requestId, sessionId }, async () => {
      const metadata = await this.repository.getMetadata(sessionId);
      if (!metadata) throw new SessionNotFoundError();
      const page = await this.repository.getMessages(sessionId, cursor);
      return { ...metadata, messages: page.messages, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) };
    });
  }
}
