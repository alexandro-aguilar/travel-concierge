import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DynamoDbSessionRepository } from '../../../../../src/lambdas/sessions/infrastructure/repositories/dynamodb-session-repository.js';

const runIntegration = process.env.RUN_LOCALSTACK_INTEGRATION === '1';
const tableName = `sessions-integration-${Date.now()}`;
const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.LOCALSTACK_ENDPOINT ?? 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
const repository = new DynamoDbSessionRepository(DynamoDBDocumentClient.from(rawClient), tableName);

(runIntegration ? describe : describe.skip)('DynamoDB session repository (LocalStack)', () => {
  beforeAll(async () => {
    await rawClient.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
      }),
    );
    await waitUntilTableExists({ client: rawClient, maxWaitTime: 30 }, { TableName: tableName });
    await rawClient.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      }),
    );
  });
  afterAll(async () => {
    await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
  });
  it('persists normalized records and retrieves transcript messages newest first', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000001';
    await repository.create({
      metadata: {
        sessionId,
        status: 'COLLECTING_REQUIREMENTS',
        createdAt: '2026-08-10T12:00:00.000Z',
        updatedAt: '2026-08-10T12:00:00.000Z',
        version: 1,
      },
      trip: { sessionId, status: 'COLLECTING_REQUIREMENTS', requirements: {} },
      expiresAt: 1_800_000_000,
    });
    await repository.appendMessage(
      sessionId,
      {
        messageId: '00000000-0000-4000-8000-000000000002',
        role: 'USER',
        content: 'first',
        createdAt: '2026-08-10T12:00:01.000Z',
      },
      1,
      1_800_000_000,
    );
    await repository.appendMessage(
      sessionId,
      {
        messageId: '00000000-0000-4000-8000-000000000003',
        role: 'USER',
        content: 'second',
        createdAt: '2026-08-10T12:00:02.000Z',
      },
      2,
      1_800_000_000,
    );
    const page = await repository.getMessages(sessionId);
    expect(page.messages.map((message) => message.content)).toEqual(['second', 'first']);
    expect((await repository.getMetadata(sessionId))?.version).toBe(3);
  });
  it('conditionally persists the approval lifecycle and simulated result', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000010';
    await repository.create({
      metadata: {
        sessionId,
        status: 'COLLECTING_REQUIREMENTS',
        createdAt: '2026-08-10T12:00:00.000Z',
        updatedAt: '2026-08-10T12:00:00.000Z',
        version: 1,
      },
      trip: { sessionId, status: 'COLLECTING_REQUIREMENTS', requirements: {} },
      expiresAt: 1_800_000_000,
    });
    await repository.updateTripAndAppendMessage(
      sessionId,
      { sessionId, status: 'RECOMMENDATION_READY', requirements: {} },
      {
        messageId: '00000000-0000-4000-8000-000000000011',
        role: 'ASSISTANT',
        content: 'Recommendation ready',
        createdAt: '2026-08-10T12:00:01.000Z',
      },
      1,
      1_800_000_000,
    );
    const awaiting = await repository.transitionToAwaitingApproval(
      sessionId,
      2,
      1_800_000_000,
      '2026-08-10T12:00:02.000Z',
    );
    expect(awaiting.status).toBe('AWAITING_APPROVAL');
    await repository.completeSimulatedBooking(
      sessionId,
      {
        sessionId,
        status: 'SIMULATED_BOOKING_COMPLETE',
        requirements: {},
        booking: {
          status: 'confirmed',
          simulation: true,
          confirmationId: 'DEMO-LOCALSTACK',
          createdAt: '2026-08-10T12:00:03.000Z',
        },
      },
      3,
      1_800_000_000,
    );
    expect(await repository.getTrip(sessionId)).toMatchObject({
      status: 'SIMULATED_BOOKING_COMPLETE',
      booking: { simulation: true, confirmationId: 'DEMO-LOCALSTACK' },
    });
  });
});
