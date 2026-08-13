import { describe, expect, it } from 'vitest';
import { optimize } from '../../../../src/lambdas/sessions/domain/optimizer.js';
import type { TripRequirements } from '../../../../src/lambdas/sessions/domain/models/concierge.js';
const requirements: TripRequirements = {
  origin: { city: 'Mexico City' },
  destination: { city: 'London' },
  departureDate: '2026-09-12',
  returnDate: '2026-09-18',
  travelers: 2,
  budget: { amount: 1000, currency: 'USD' },
  preferences: { directFlights: true, hotelMinimumRating: 4, interests: ['music'] },
};
const success = <T>(options: T[]) => ({ options });
describe('optimizer', () => {
  it('filters non-direct and under-rated choices, then selects a feasible matching event', () => {
    const selected = optimize(
      requirements,
      success([
        {
          id: 'stops',
          price: { amount: 100, currency: 'USD' },
          stops: 1,
          durationMinutes: 100,
          departureDate: '2026-09-12',
          returnDate: '2026-09-18',
        },
        {
          id: 'direct',
          price: { amount: 300, currency: 'USD' },
          stops: 0,
          durationMinutes: 400,
          departureDate: '2026-09-12',
          returnDate: '2026-09-18',
        },
      ]),
      success([
        {
          id: 'low',
          price: { amount: 100, currency: 'USD' },
          rating: 3,
          checkInDate: '2026-09-12',
          checkOutDate: '2026-09-18',
        },
        {
          id: 'good',
          price: { amount: 400, currency: 'USD' },
          rating: 4.5,
          checkInDate: '2026-09-12',
          checkOutDate: '2026-09-18',
        },
      ]),
      success([
        {
          id: 'music',
          price: { amount: 50, currency: 'USD' },
          category: 'music',
          date: '2026-09-14',
        },
      ]),
      success([]),
    );
    expect(selected?.flight.id).toBe('direct');
    expect(selected?.hotel.id).toBe('good');
    expect(selected?.event?.id).toBe('music');
    expect(selected?.total.amount).toBe(750);
  });
  it('rejects mixed currencies rather than guessing an exchange rate', () => {
    const selected = optimize(
      requirements,
      success([
        {
          id: 'f',
          price: { amount: 300, currency: 'EUR' },
          stops: 0,
          durationMinutes: 100,
          departureDate: '2026-09-12',
          returnDate: '2026-09-18',
        },
      ]),
      success([
        {
          id: 'h',
          price: { amount: 300, currency: 'USD' },
          rating: 5,
          checkInDate: '2026-09-12',
          checkOutDate: '2026-09-18',
        },
      ]),
      success([]),
      success([]),
    );
    expect(selected).toBeUndefined();
  });
});
