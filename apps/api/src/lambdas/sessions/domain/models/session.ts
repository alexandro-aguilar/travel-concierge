export const tripStates = [
  'COLLECTING_REQUIREMENTS',
  'SEARCHING',
  'OPTIMIZING',
  'RECOMMENDATION_READY',
  'AWAITING_APPROVAL',
  'SIMULATED_BOOKING_COMPLETE',
  'FAILED',
] as const;

export type TripStatus = (typeof tripStates)[number];

export interface SessionMetadata {
  readonly sessionId: string;
  readonly status: TripStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface Trip {
  readonly sessionId: string;
  readonly status: TripStatus;
  readonly requirements: Record<string, never>;
}

export interface SessionMessage {
  readonly messageId: string;
  readonly role: 'USER';
  readonly content: string;
  readonly createdAt: string;
}

export interface MessagePage {
  readonly messages: readonly SessionMessage[];
  readonly nextCursor?: string;
}
