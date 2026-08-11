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

export const sessionsTypes = {
  create: Symbol.for('sessions.create'),
  append: Symbol.for('sessions.append'),
  getSession: Symbol.for('sessions.getSession'),
  getTrip: Symbol.for('sessions.getTrip'),
  repository: Symbol.for('sessions.repository'),
  clock: Symbol.for('sessions.clock'),
  ids: Symbol.for('sessions.ids'),
  telemetry: Symbol.for('sessions.telemetry'),
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
  return container;
};
