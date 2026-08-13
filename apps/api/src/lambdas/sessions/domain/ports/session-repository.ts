import type { MessagePage, SessionMessage, SessionMetadata, Trip } from '../models/session.js';

export interface NewSession {
  readonly metadata: SessionMetadata;
  readonly trip: Trip;
  readonly expiresAt: number;
}

export interface SessionRepository {
  create(session: NewSession): Promise<void>;
  appendMessage(
    sessionId: string,
    message: SessionMessage,
    expectedVersion: number,
    expiresAt: number,
  ): Promise<SessionMetadata>;
  updateTripAndAppendMessage(
    sessionId: string,
    trip: Trip,
    message: SessionMessage,
    expectedVersion: number,
    expiresAt: number,
  ): Promise<SessionMetadata>;
  transitionToAwaitingApproval(
    sessionId: string,
    expectedVersion: number,
    expiresAt: number,
    updatedAt: string,
  ): Promise<SessionMetadata>;
  completeSimulatedBooking(
    sessionId: string,
    trip: Trip,
    expectedVersion: number,
    expiresAt: number,
  ): Promise<SessionMetadata>;
  getMetadata(sessionId: string): Promise<SessionMetadata | undefined>;
  getMessages(sessionId: string, cursor?: string): Promise<MessagePage>;
  getTrip(sessionId: string): Promise<Trip | undefined>;
}
