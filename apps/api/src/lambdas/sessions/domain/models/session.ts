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

import type { PartialRequirements, Recommendation } from './concierge.js';
export interface Trip {
  readonly sessionId: string;
  readonly status: TripStatus;
  readonly requirements: PartialRequirements;
  readonly recommendation?: Recommendation;
  readonly failure?: {
    readonly code:
      'UNSUPPORTED_CURRENCY' | 'NO_FEASIBLE_ITINERARY' | 'PROVIDER_FAILURE' | 'MODEL_FAILURE';
    readonly message: string;
  };
  readonly booking?: SimulatedBooking;
}

export interface SimulatedBooking {
  readonly status: 'confirmed';
  readonly simulation: true;
  readonly confirmationId: string;
  readonly createdAt: string;
}

export interface SessionMessage {
  readonly messageId: string;
  readonly role: 'USER' | 'ASSISTANT';
  readonly content: string;
  readonly createdAt: string;
}

export interface MessagePage {
  readonly messages: readonly SessionMessage[];
  readonly nextCursor?: string;
}
