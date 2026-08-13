import type { SimulatedBooking, Trip } from '../../domain/models/session.js';
import type { BookingSimulator } from '../../domain/ports/booking-simulator.js';
import type { Clock, IdGenerator } from '../../domain/ports/runtime.js';

export class DeterministicBookingSimulator implements BookingSimulator {
  public constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async simulate(trip: Trip): Promise<SimulatedBooking> {
    void trip;
    return {
      status: 'confirmed',
      simulation: true,
      confirmationId: `DEMO-${this.ids.uuid().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      createdAt: this.clock.now().toISOString(),
    };
  }
}
