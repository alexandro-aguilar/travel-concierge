import 'reflect-metadata';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Container } from 'inversify';
import { randomUUID } from 'node:crypto';
import { AppendMessageHandler } from './commands/append-message/handler.js';
import { CreateSessionHandler } from './commands/create-session/handler.js';
import type { Clock, IdGenerator, Telemetry } from './domain/ports/runtime.js';
import type { SessionRepository } from './domain/ports/session-repository.js';
import { DynamoDbSessionRepository } from './infrastructure/repositories/dynamodb-session-repository.js';
import { GetSessionHandler } from './queries/get-session/handler.js';
import { GetTripHandler } from './queries/get-trip/handler.js';
import { StructuredTelemetry } from './telemetry/telemetry.js';
import type {
  ConciergeModel,
  EventSearch,
  FlightSearch,
  HotelSearch,
  WeatherSearch,
} from './domain/ports/concierge.js';
import {
  MockEventSearch,
  MockFlightSearch,
  MockHotelSearch,
  MockWeatherSearch,
  RuleBasedConciergeModel,
} from './infrastructure/providers/mock-providers.js';
import { ConciergeWorkflow } from './commands/append-message/concierge-workflow.js';
import { ApproveTripHandler } from './commands/approve-trip/handler.js';
import type { BookingSimulator } from './domain/ports/booking-simulator.js';
import { DeterministicBookingSimulator } from './infrastructure/booking/deterministic-booking-simulator.js';

export const sessionsTypes = {
  create: Symbol.for('sessions.create'),
  append: Symbol.for('sessions.append'),
  getSession: Symbol.for('sessions.getSession'),
  getTrip: Symbol.for('sessions.getTrip'),
  repository: Symbol.for('sessions.repository'),
  clock: Symbol.for('sessions.clock'),
  ids: Symbol.for('sessions.ids'),
  telemetry: Symbol.for('sessions.telemetry'),
  workflow: Symbol.for('sessions.workflow'),
  model: Symbol.for('sessions.model'),
  flights: Symbol.for('sessions.flights'),
  hotels: Symbol.for('sessions.hotels'),
  events: Symbol.for('sessions.events'),
  weather: Symbol.for('sessions.weather'),
  approve: Symbol.for('sessions.approve'),
  bookingSimulator: Symbol.for('sessions.bookingSimulator'),
};

export interface SessionsConfiguration {
  readonly tableName: string;
  readonly ttlDays: number;
  readonly region: string;
  readonly endpoint?: string;
}
export const createSessionsContainer = (configuration: SessionsConfiguration): Container => {
  const container = new Container();
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: configuration.region,
      ...(configuration.endpoint ? { endpoint: configuration.endpoint } : {}),
    }),
  );
  container
    .bind<SessionRepository>(sessionsTypes.repository)
    .toConstantValue(new DynamoDbSessionRepository(client, configuration.tableName));
  container.bind<Clock>(sessionsTypes.clock).toConstantValue({ now: () => new Date() });
  container.bind<IdGenerator>(sessionsTypes.ids).toConstantValue({ uuid: () => randomUUID() });
  container.bind<Telemetry>(sessionsTypes.telemetry).toConstantValue(new StructuredTelemetry());
  // Mock adapters are intentionally the safe local default. Live adapters remain a configuration boundary.
  container
    .bind<ConciergeModel>(sessionsTypes.model)
    .toConstantValue(new RuleBasedConciergeModel());
  container.bind<FlightSearch>(sessionsTypes.flights).toConstantValue(new MockFlightSearch());
  container.bind<HotelSearch>(sessionsTypes.hotels).toConstantValue(new MockHotelSearch());
  container.bind<EventSearch>(sessionsTypes.events).toConstantValue(new MockEventSearch());
  container.bind<WeatherSearch>(sessionsTypes.weather).toConstantValue(new MockWeatherSearch());
  container
    .bind<BookingSimulator>(sessionsTypes.bookingSimulator)
    .toDynamicValue(
      (context) =>
        new DeterministicBookingSimulator(
          context.get(sessionsTypes.clock),
          context.get(sessionsTypes.ids),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.workflow)
    .toDynamicValue(
      (context) =>
        new ConciergeWorkflow(
          context.get(sessionsTypes.model),
          context.get(sessionsTypes.flights),
          context.get(sessionsTypes.hotels),
          context.get(sessionsTypes.events),
          context.get(sessionsTypes.weather),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.create)
    .toDynamicValue(
      (context) =>
        new CreateSessionHandler(
          context.get(sessionsTypes.repository),
          context.get(sessionsTypes.clock),
          context.get(sessionsTypes.ids),
          configuration.ttlDays,
          context.get(sessionsTypes.telemetry),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.append)
    .toDynamicValue(
      (context) =>
        new AppendMessageHandler(
          context.get(sessionsTypes.repository),
          context.get(sessionsTypes.clock),
          context.get(sessionsTypes.ids),
          configuration.ttlDays,
          context.get(sessionsTypes.telemetry),
          context.get(sessionsTypes.workflow),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.getSession)
    .toDynamicValue(
      (context) =>
        new GetSessionHandler(
          context.get(sessionsTypes.repository),
          context.get(sessionsTypes.telemetry),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.getTrip)
    .toDynamicValue(
      (context) =>
        new GetTripHandler(
          context.get(sessionsTypes.repository),
          context.get(sessionsTypes.telemetry),
        ),
    )
    .inSingletonScope();
  container
    .bind(sessionsTypes.approve)
    .toDynamicValue(
      (context) =>
        new ApproveTripHandler(
          context.get(sessionsTypes.repository),
          context.get(sessionsTypes.bookingSimulator),
          context.get(sessionsTypes.clock),
          configuration.ttlDays,
          context.get(sessionsTypes.telemetry),
        ),
    )
    .inSingletonScope();
  return container;
};
