import type { SimulatedBooking, Trip } from '../models/session.js';

export interface BookingSimulator {
  simulate(trip: Trip): Promise<SimulatedBooking>;
}
