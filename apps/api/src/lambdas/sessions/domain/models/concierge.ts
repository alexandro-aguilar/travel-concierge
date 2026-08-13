import { z } from 'zod';

const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const moneySchema = z
  .object({ amount: z.number().finite().nonnegative(), currency: currencySchema })
  .strict();
export const partialRequirementsSchema = z
  .object({
    origin: z
      .object({ city: z.string().min(1), iataCode: z.string().length(3).optional() })
      .strict()
      .optional(),
    destination: z
      .object({
        city: z.string().min(1),
        iataCodes: z.array(z.string().length(3)).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
      .strict()
      .optional(),
    departureDate: z.string().date().optional(),
    returnDate: z.string().date().optional(),
    travelers: z.number().int().min(1).max(9).optional(),
    budget: moneySchema.optional(),
    preferences: z
      .object({
        directFlights: z.boolean().optional(),
        hotelMinimumRating: z.number().min(0).max(5).optional(),
        interests: z.array(z.string().min(1)).max(10).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const requirementsSchema = partialRequirementsSchema
  .extend({
    origin: partialRequirementsSchema.shape.origin.unwrap(),
    destination: partialRequirementsSchema.shape.destination.unwrap(),
    departureDate: z.string().date(),
    returnDate: z.string().date(),
    travelers: z.number().int().min(1).max(9),
    budget: moneySchema,
    preferences: partialRequirementsSchema.shape.preferences.default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.returnDate <= value.departureDate)
      ctx.addIssue({
        code: 'custom',
        message: 'returnDate must be after departureDate',
        path: ['returnDate'],
      });
  });
export const flightOptionSchema = z
  .object({
    id: z.string().min(1),
    price: moneySchema,
    stops: z.number().int().min(0),
    durationMinutes: z.number().int().positive(),
    departureDate: z.string().date(),
    returnDate: z.string().date(),
  })
  .strict();
export const hotelOptionSchema = z
  .object({
    id: z.string().min(1),
    price: moneySchema,
    rating: z.number().min(0).max(5),
    checkInDate: z.string().date(),
    checkOutDate: z.string().date(),
  })
  .strict();
export const eventOptionSchema = z
  .object({
    id: z.string().min(1),
    price: moneySchema,
    category: z.string().min(1),
    date: z.string().date(),
  })
  .strict();
export const weatherOptionSchema = z
  .object({ precipitationProbability: z.number().min(0).max(100), forecastDate: z.string().date() })
  .strict();
export const providerFailureSchema = z
  .object({
    category: z.enum(['TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE', 'MALFORMED_RESULT', 'EMPTY']),
    optional: z.boolean(),
  })
  .strict();
export type Money = z.infer<typeof moneySchema>;
export type PartialRequirements = z.infer<typeof partialRequirementsSchema>;
export type TripRequirements = z.infer<typeof requirementsSchema>;
export type FlightOption = z.infer<typeof flightOptionSchema>;
export type HotelOption = z.infer<typeof hotelOptionSchema>;
export type EventOption = z.infer<typeof eventOptionSchema>;
export type WeatherOption = z.infer<typeof weatherOptionSchema>;
export type ProviderFailure = z.infer<typeof providerFailureSchema>;
export interface ProviderOutcome<T> {
  readonly options: readonly T[];
  readonly failure?: ProviderFailure;
}
export interface Recommendation {
  readonly flight: FlightOption;
  readonly hotel: HotelOption;
  readonly event?: EventOption;
  readonly weather?: WeatherOption;
  readonly total: Money;
  readonly budgetDelta: number;
  readonly score: number;
  readonly rejectedConstraints: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly availability: Readonly<Record<string, 'AVAILABLE' | 'UNAVAILABLE'>>;
}
export const modelDecisionSchema = z
  .object({
    requirements: partialRequirementsSchema,
    missingFields: z.array(z.string()),
    assistantMessage: z.string().min(1).max(2000),
  })
  .strict();
export type ModelDecision = z.infer<typeof modelDecisionSchema>;
