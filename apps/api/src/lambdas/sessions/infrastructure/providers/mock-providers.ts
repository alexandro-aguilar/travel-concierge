import type {
  ConciergeModel,
  EventSearch,
  FlightSearch,
  HotelSearch,
  WeatherSearch,
} from '../../domain/ports/concierge.js';
import {
  modelDecisionSchema,
  type EventOption,
  type FlightOption,
  type HotelOption,
  type PartialRequirements,
  type TripRequirements,
  type WeatherOption,
  type Recommendation,
} from '../../domain/models/concierge.js';
const outcome = <T>(options: readonly T[]) => ({ options });
export class RuleBasedConciergeModel implements ConciergeModel {
  public async decide(message: string, previous: PartialRequirements) {
    const text = message.toLowerCase();
    const next: PartialRequirements = { ...previous, preferences: { ...previous.preferences } };
    const route = /from ([a-z ]+?) to ([a-z ]+?)(?:\s+from|\s+on|\s+for|\.|$)/i.exec(message);
    if (route) {
      next.origin = { city: route[1]!.trim() };
      next.destination = { city: route[2]!.trim(), latitude: 51.5072, longitude: -0.1276 };
    }
    const dates = /(20\d{2}-\d{2}-\d{2})\s+(?:to|through|until)\s+(20\d{2}-\d{2}-\d{2})/.exec(
      message,
    );
    if (dates) {
      next.departureDate = dates[1];
      next.returnDate = dates[2];
    }
    const travelers = /(?:for |)(\d+) (?:people|travelers?)/.exec(text);
    if (travelers) next.travelers = Number(travelers[1]);
    const budget = /(?:budget (?:of )?|\$)(\d+(?:\.\d+)?)\s*(mxn|usd|eur|gbp)?/i.exec(message);
    if (budget)
      next.budget = { amount: Number(budget[1]), currency: (budget[2] ?? 'USD').toUpperCase() };
    if (text.includes('direct')) next.preferences = { ...next.preferences, directFlights: true };
    const rating = /(?:rating|hotel).*?(\d(?:\.\d)?)/.exec(text);
    if (rating) next.preferences = { ...next.preferences, hotelMinimumRating: Number(rating[1]) };
    const missing = [
      'origin',
      'destination',
      'departureDate',
      'returnDate',
      'travelers',
      'budget',
    ].filter((key) => !(next as Record<string, unknown>)[key]);
    return modelDecisionSchema.parse({
      requirements: next,
      missingFields: missing,
      assistantMessage: missing.length
        ? `I still need: ${missing.join(', ')}.`
        : 'I have your requirements and am searching options.',
    });
  }
  public async explain(r: Recommendation): Promise<string> {
    return `I recommend ${r.flight.id} and ${r.hotel.id} for ${r.total.amount} ${r.total.currency}.`;
  }
}
export class MockFlightSearch implements FlightSearch {
  public async search(r: TripRequirements) {
    const option: FlightOption = {
      id: 'mock-flight-direct',
      price: { amount: 300, currency: r.budget.currency },
      stops: 0,
      durationMinutes: 480,
      departureDate: r.departureDate,
      returnDate: r.returnDate,
    };
    return outcome([option]);
  }
}
export class MockHotelSearch implements HotelSearch {
  public async search(r: TripRequirements) {
    const option: HotelOption = {
      id: 'mock-hotel-four-star',
      price: { amount: 400, currency: r.budget.currency },
      rating: 4.5,
      checkInDate: r.departureDate,
      checkOutDate: r.returnDate,
    };
    return outcome([option]);
  }
}
export class MockEventSearch implements EventSearch {
  public async search(r: TripRequirements) {
    const option: EventOption = {
      id: 'mock-event-music',
      price: { amount: 50, currency: r.budget.currency },
      category: 'music',
      date: r.departureDate,
    };
    return outcome([option]);
  }
}
export class MockWeatherSearch implements WeatherSearch {
  public async search(r: TripRequirements) {
    const option: WeatherOption = { precipitationProbability: 20, forecastDate: r.departureDate };
    return outcome([option]);
  }
}
