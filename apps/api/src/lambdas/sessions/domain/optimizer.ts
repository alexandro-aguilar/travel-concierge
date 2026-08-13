import type {
  EventOption,
  FlightOption,
  HotelOption,
  Money,
  ProviderOutcome,
  Recommendation,
  TripRequirements,
  WeatherOption,
} from './models/concierge.js';
const sum = (...amounts: readonly Money[]): Money => ({
  amount: amounts.reduce((total, item) => total + item.amount, 0),
  currency: amounts[0]?.currency ?? '',
});
const sameCurrency = (currency: string, values: readonly Money[]): boolean =>
  values.every((value) => value.currency === currency);
export const optimize = (
  requirements: TripRequirements,
  flights: ProviderOutcome<FlightOption>,
  hotels: ProviderOutcome<HotelOption>,
  events: ProviderOutcome<EventOption>,
  weather: ProviderOutcome<WeatherOption>,
): Recommendation | undefined => {
  const budget = requirements.budget;
  const rejected: string[] = [];
  const eligibleFlights = flights.options.filter(
    (f) =>
      f.departureDate === requirements.departureDate &&
      f.returnDate === requirements.returnDate &&
      (!requirements.preferences.directFlights || f.stops === 0),
  );
  const eligibleHotels = hotels.options.filter(
    (h) =>
      h.checkInDate === requirements.departureDate &&
      h.checkOutDate === requirements.returnDate &&
      (requirements.preferences.hotelMinimumRating === undefined ||
        h.rating >= requirements.preferences.hotelMinimumRating),
  );
  if (!eligibleFlights.length) rejected.push('NO_FEASIBLE_FLIGHT');
  if (!eligibleHotels.length) rejected.push('NO_FEASIBLE_HOTEL');
  const candidates: Recommendation[] = [];
  for (const flight of eligibleFlights)
    for (const hotel of eligibleHotels) {
      const matchingEvents = requirements.preferences.interests?.length
        ? events.options.filter(
            (e) =>
              requirements.preferences.interests?.includes(e.category) &&
              e.date >= requirements.departureDate &&
              e.date <= requirements.returnDate,
          )
        : [];
      for (const event of [undefined, ...matchingEvents]) {
        const money = sum(flight.price, hotel.price, ...(event ? [event.price] : []));
        if (
          !sameCurrency(budget.currency, [
            flight.price,
            hotel.price,
            ...(event ? [event.price] : []),
          ])
        ) {
          rejected.push('UNSUPPORTED_CURRENCY');
          continue;
        }
        if (money.amount > budget.amount) {
          rejected.push('OVER_BUDGET');
          continue;
        }
        const dimensions: Array<[number, number]> = [
          [0.3, (budget.amount - money.amount) / Math.max(budget.amount, 1)],
          [0.25, 1 / (1 + flight.stops + flight.durationMinutes / 10000)],
          [0.2, hotel.rating / 5],
        ];
        if (requirements.preferences.interests?.length) dimensions.push([0.15, event ? 1 : 0]);
        if (weather.options[0])
          dimensions.push([0.1, 1 - weather.options[0].precipitationProbability / 100]);
        const weights = dimensions.reduce((n, [weight]) => n + weight, 0);
        const score = dimensions.reduce((n, [weight, value]) => n + (weight / weights) * value, 0);
        candidates.push({
          flight,
          hotel,
          ...(event ? { event } : {}),
          ...(weather.options[0] ? { weather: weather.options[0] } : {}),
          total: money,
          budgetDelta: budget.amount - money.amount,
          score,
          rejectedConstraints: [],
          tradeoffs: event ? [] : ['No matching event was added'],
          availability: {
            flights: flights.failure ? 'UNAVAILABLE' : 'AVAILABLE',
            hotels: hotels.failure ? 'UNAVAILABLE' : 'AVAILABLE',
            events: events.failure ? 'UNAVAILABLE' : 'AVAILABLE',
            weather: weather.failure ? 'UNAVAILABLE' : 'AVAILABLE',
          },
        });
      }
    }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.total.amount - b.total.amount ||
      `${a.flight.id}/${a.hotel.id}/${a.event?.id ?? ''}`.localeCompare(
        `${b.flight.id}/${b.hotel.id}/${b.event?.id ?? ''}`,
      ),
  );
  const selected = candidates[0];
  return selected ? { ...selected, rejectedConstraints: [...new Set(rejected)] } : undefined;
};
