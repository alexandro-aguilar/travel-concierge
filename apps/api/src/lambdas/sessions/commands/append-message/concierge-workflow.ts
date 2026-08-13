import {
  requirementsSchema,
  type EventOption,
  type FlightOption,
  type HotelOption,
  type PartialRequirements,
  type ProviderOutcome,
} from '../../domain/models/concierge.js';
import type {
  EventSearch,
  FlightSearch,
  HotelSearch,
  WeatherSearch,
  ConciergeModel,
} from '../../domain/ports/concierge.js';
import { optimize } from '../../domain/optimizer.js';
import type { Trip } from '../../domain/models/session.js';

export class ConciergeWorkflow {
  public constructor(
    private readonly model: ConciergeModel,
    private readonly flights: FlightSearch,
    private readonly hotels: HotelSearch,
    private readonly events: EventSearch,
    private readonly weather: WeatherSearch,
  ) {}
  public async run(
    message: string,
    previous: PartialRequirements,
  ): Promise<{ readonly trip: Trip; readonly assistantMessage: string }> {
    let decision;
    try {
      decision = await this.model.decide(message, previous);
    } catch {
      return this.failed(
        previous,
        'MODEL_FAILURE',
        'I could not safely understand those trip details. Please try again.',
      );
    }
    const requirements = decision.requirements;
    const complete = requirementsSchema.safeParse(requirements);
    if (!complete.success || decision.missingFields.length)
      return {
        trip: { sessionId: '', status: 'COLLECTING_REQUIREMENTS', requirements },
        assistantMessage: decision.assistantMessage,
      };
    const [flightResult, hotelResult, eventResult] = await Promise.allSettled([
      this.flights.search(complete.data),
      this.hotels.search(complete.data),
      this.events.search(complete.data),
    ]);
    const unavailable = <T>(): ProviderOutcome<T> => ({
      options: [],
      failure: { category: 'UNAVAILABLE', optional: false },
    });
    const flights: ProviderOutcome<FlightOption> =
      flightResult.status === 'fulfilled' ? flightResult.value : unavailable<FlightOption>();
    const hotels: ProviderOutcome<HotelOption> =
      hotelResult.status === 'fulfilled' ? hotelResult.value : unavailable<HotelOption>();
    const events: ProviderOutcome<EventOption> =
      eventResult.status === 'fulfilled'
        ? eventResult.value
        : { options: [], failure: { category: 'UNAVAILABLE', optional: true } };
    if (flights.failure || hotels.failure)
      return this.failed(
        requirements,
        'PROVIDER_FAILURE',
        'Essential travel search is temporarily unavailable. Please try again.',
      );
    const weather =
      complete.data.destination.latitude !== undefined &&
      complete.data.destination.longitude !== undefined
        ? await this.weather.search(complete.data).catch(() => ({
            options: [],
            failure: { category: 'UNAVAILABLE' as const, optional: true },
          }))
        : { options: [], failure: { category: 'UNAVAILABLE' as const, optional: true } };
    const recommendation = optimize(complete.data, flights, hotels, events, weather);
    if (!recommendation) {
      const code = [...flights.options, ...hotels.options, ...events.options].some(
        (option) => option.price.currency !== complete.data.budget.currency,
      )
        ? 'UNSUPPORTED_CURRENCY'
        : 'NO_FEASIBLE_ITINERARY';
      return this.failed(
        requirements,
        code,
        code === 'UNSUPPORTED_CURRENCY'
          ? 'The available options use a currency that cannot be compared to your budget.'
          : 'No itinerary meets your constraints and budget.',
      );
    }
    let explanation: string;
    try {
      explanation = await this.model.explain(recommendation);
    } catch {
      explanation = `I found a feasible itinerary totaling ${recommendation.total.amount} ${recommendation.total.currency}.`;
    }
    return {
      trip: { sessionId: '', status: 'RECOMMENDATION_READY', requirements, recommendation },
      assistantMessage: explanation,
    };
  }
  private failed(
    requirements: PartialRequirements,
    code: 'UNSUPPORTED_CURRENCY' | 'NO_FEASIBLE_ITINERARY' | 'PROVIDER_FAILURE' | 'MODEL_FAILURE',
    message: string,
  ): { readonly trip: Trip; readonly assistantMessage: string } {
    return {
      trip: { sessionId: '', status: 'FAILED', requirements, failure: { code, message } },
      assistantMessage: message,
    };
  }
}
