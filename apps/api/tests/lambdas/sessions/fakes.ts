import { ConditionalWriteConflictError } from '../../../src/lambdas/sessions/domain/errors/errors.js';
import type {
  MessagePage,
  SessionMessage,
  SessionMetadata,
  Trip,
} from '../../../src/lambdas/sessions/domain/models/session.js';
import type {
  Clock,
  IdGenerator,
  Telemetry,
} from '../../../src/lambdas/sessions/domain/ports/runtime.js';
import type {
  NewSession,
  SessionRepository,
} from '../../../src/lambdas/sessions/domain/ports/session-repository.js';

export class InMemorySessionRepository implements SessionRepository {
  public metadata?: SessionMetadata;
  public trip?: Trip;
  public messages: SessionMessage[] = [];
  public conflict = false;
  public async create(session: NewSession): Promise<void> {
    this.metadata = session.metadata;
    this.trip = session.trip;
  }
  public async appendMessage(
    sessionId: string,
    message: SessionMessage,
    expectedVersion: number,
  ): Promise<SessionMetadata> {
    if (!this.metadata || this.metadata.sessionId !== sessionId)
      throw new ConditionalWriteConflictError();
    if (this.conflict || this.metadata.version !== expectedVersion)
      throw new ConditionalWriteConflictError();
    this.messages.push(message);
    this.metadata = {
      ...this.metadata,
      updatedAt: message.createdAt,
      version: expectedVersion + 1,
    };
    return this.metadata;
  }
  public async updateTripAndAppendMessage(
    sessionId: string,
    trip: Trip,
    message: SessionMessage,
    expectedVersion: number,
  ): Promise<SessionMetadata> {
    if (
      !this.metadata ||
      this.metadata.sessionId !== sessionId ||
      this.conflict ||
      this.metadata.version !== expectedVersion
    )
      throw new ConditionalWriteConflictError();
    this.messages.push(message);
    this.trip = trip;
    this.metadata = {
      ...this.metadata,
      status: trip.status,
      updatedAt: message.createdAt,
      version: expectedVersion + 1,
    };
    return this.metadata;
  }
  public async transitionToAwaitingApproval(
    sessionId: string,
    expectedVersion: number,
    _expiresAt: number,
    updatedAt: string,
  ): Promise<SessionMetadata> {
    if (
      !this.metadata ||
      !this.trip ||
      this.metadata.sessionId !== sessionId ||
      this.conflict ||
      this.metadata.version !== expectedVersion ||
      this.metadata.status !== 'RECOMMENDATION_READY'
    )
      throw new ConditionalWriteConflictError();
    this.metadata = {
      ...this.metadata,
      status: 'AWAITING_APPROVAL',
      updatedAt,
      version: expectedVersion + 1,
    };
    this.trip = { ...this.trip, status: 'AWAITING_APPROVAL' };
    return this.metadata;
  }
  public async completeSimulatedBooking(
    sessionId: string,
    trip: Trip,
    expectedVersion: number,
  ): Promise<SessionMetadata> {
    if (
      !this.metadata ||
      this.metadata.sessionId !== sessionId ||
      this.conflict ||
      this.metadata.version !== expectedVersion ||
      this.metadata.status !== 'AWAITING_APPROVAL'
    )
      throw new ConditionalWriteConflictError();
    this.trip = trip;
    this.metadata = {
      ...this.metadata,
      status: 'SIMULATED_BOOKING_COMPLETE',
      version: expectedVersion + 1,
    };
    return this.metadata;
  }
  public async getMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
    return this.metadata?.sessionId === sessionId ? this.metadata : undefined;
  }
  public async getMessages(sessionId: string): Promise<MessagePage> {
    return { messages: this.metadata?.sessionId === sessionId ? [...this.messages].reverse() : [] };
  }
  public async getTrip(sessionId: string): Promise<Trip | undefined> {
    return this.trip?.sessionId === sessionId ? this.trip : undefined;
  }
}
export const clock = (value = '2026-08-10T12:00:00.000Z'): Clock => ({
  now: () => new Date(value),
});
export const ids = (...values: string[]): IdGenerator => ({
  uuid: () => values.shift() ?? '00000000-0000-4000-8000-000000000099',
});
export const telemetry: Telemetry = { span: async (_tool, _fields, action) => action() };
