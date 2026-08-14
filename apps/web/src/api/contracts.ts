import { z } from 'zod';

const money = z
  .object({ amount: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) })
  .strict();
const tripStatus = z.enum([
  'COLLECTING_REQUIREMENTS',
  'SEARCHING',
  'OPTIMIZING',
  'RECOMMENDATION_READY',
  'AWAITING_APPROVAL',
  'SIMULATED_BOOKING_COMPLETE',
  'FAILED',
]);
const flight = z
  .object({
    id: z.string(),
    price: money,
    stops: z.number().int().nonnegative(),
    durationMinutes: z.number().int().positive(),
    departureDate: z.string(),
    returnDate: z.string(),
  })
  .strict();
const hotel = z
  .object({
    id: z.string(),
    price: money,
    rating: z.number(),
    checkInDate: z.string(),
    checkOutDate: z.string(),
  })
  .strict();
const event = z
  .object({ id: z.string(), price: money, category: z.string(), date: z.string() })
  .strict();
const weather = z
  .object({ precipitationProbability: z.number(), forecastDate: z.string() })
  .strict();
const recommendation = z
  .object({
    flight,
    hotel,
    event: event.optional(),
    weather: weather.optional(),
    total: money,
    budgetDelta: z.number(),
    score: z.number(),
    rejectedConstraints: z.array(z.string()),
    tradeoffs: z.array(z.string()),
    availability: z.record(z.string(), z.enum(['AVAILABLE', 'UNAVAILABLE'])),
  })
  .strict();
const message = z
  .object({
    messageId: z.string(),
    role: z.enum(['USER', 'ASSISTANT']),
    content: z.string(),
    createdAt: z.string(),
  })
  .strict();
export const sessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    status: tripStatus,
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    version: z.number().int().optional(),
    messages: z.array(message).default([]),
    nextCursor: z.string().optional(),
  })
  .strict();
export const tripSchema = z
  .object({
    sessionId: z.string().uuid(),
    status: tripStatus,
    requirements: z.record(z.string(), z.unknown()),
    recommendation: recommendation.optional(),
    failure: z.object({ code: z.string(), message: z.string() }).strict().optional(),
    booking: z
      .object({
        status: z.literal('confirmed'),
        simulation: z.literal(true),
        confirmationId: z.string().regex(/^DEMO-/),
        createdAt: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const messageResponseSchema = z
  .object({
    sessionId: z.string().uuid(),
    message,
    assistantMessage: message.optional(),
    trip: tripSchema,
    status: tripStatus,
  })
  .strict();
export const approvalResponseSchema = z
  .object({ trip: tripSchema, booking: tripSchema.shape.booking.unwrap() })
  .strict();
export const apiErrorSchema = z
  .object({ code: z.string(), message: z.string(), requestId: z.string() })
  .strict();
export type Session = z.infer<typeof sessionSchema>;
export type Trip = z.infer<typeof tripSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;
