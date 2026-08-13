import { InvalidTripStateError, SessionNotFoundError } from '../../domain/errors/errors.js';
import type { SimulatedBooking, Trip } from '../../domain/models/session.js';
import type { BookingSimulator } from '../../domain/ports/booking-simulator.js';
import type { Clock, Telemetry } from '../../domain/ports/runtime.js';
import type { SessionRepository } from '../../domain/ports/session-repository.js';

export class ApproveTripHandler {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly simulator: BookingSimulator,
    private readonly clock: Clock,
    private readonly ttlDays: number,
    private readonly telemetry: Telemetry,
  ) {}

  public async execute(
    requestId: string,
    sessionId: string,
  ): Promise<{ readonly trip: Trip; readonly booking: SimulatedBooking }> {
    return this.telemetry.span('booking.simulation', { requestId, sessionId }, async () => {
      const [metadata, trip] = await Promise.all([
        this.repository.getMetadata(sessionId),
        this.repository.getTrip(sessionId),
      ]);
      if (!metadata || !trip) throw new SessionNotFoundError();
      if (metadata.status !== 'AWAITING_APPROVAL' || trip.status !== 'AWAITING_APPROVAL')
        throw new InvalidTripStateError();
      const booking = await this.simulator.simulate(trip);
      const completedTrip: Trip = { ...trip, status: 'SIMULATED_BOOKING_COMPLETE', booking };
      const expiresAt = Math.floor(this.clock.now().getTime() / 1000) + this.ttlDays * 86400;
      await this.repository.completeSimulatedBooking(
        sessionId,
        completedTrip,
        metadata.version,
        expiresAt,
      );
      return { trip: completedTrip, booking };
    });
  }
}
