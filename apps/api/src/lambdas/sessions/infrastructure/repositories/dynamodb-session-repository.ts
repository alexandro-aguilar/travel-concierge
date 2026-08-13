import {
  TransactWriteCommand,
  GetCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalWriteConflictError, InvalidCursorError } from '../../domain/errors/errors.js';
import type {
  MessagePage,
  SessionMessage,
  SessionMetadata,
  Trip,
} from '../../domain/models/session.js';
import type { NewSession, SessionRepository } from '../../domain/ports/session-repository.js';

interface MetadataRecord extends SessionMetadata {
  readonly PK: string;
  readonly SK: 'METADATA';
  readonly expiresAt: number;
}
interface TripRecord extends Trip {
  readonly PK: string;
  readonly SK: 'TRIP';
  readonly expiresAt: number;
}
interface MessageRecord extends SessionMessage {
  readonly PK: string;
  readonly SK: string;
  readonly expiresAt: number;
}
const partitionKey = (sessionId: string): string => `SESSION#${sessionId}`;
const encodeCursor = (key: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(key)).toString('base64url');
const decodeCursor = (cursor: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || !('PK' in value) || !('SK' in value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new InvalidCursorError();
  }
};

export class DynamoDbSessionRepository implements SessionRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}
  public async create(session: NewSession): Promise<void> {
    const PK = partitionKey(session.metadata.sessionId);
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { ...session.metadata, PK, SK: 'METADATA', expiresAt: session.expiresAt },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: { ...session.trip, PK, SK: 'TRIP', expiresAt: session.expiresAt },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
          ],
        }),
      );
    } catch (error: unknown) {
      if (this.isConditional(error)) throw new ConditionalWriteConflictError();
      throw error;
    }
  }
  public async appendMessage(
    sessionId: string,
    message: SessionMessage,
    expectedVersion: number,
    expiresAt: number,
  ): Promise<SessionMetadata> {
    const PK = partitionKey(sessionId);
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  ...message,
                  PK,
                  SK: `MESSAGE#${message.createdAt}#${message.messageId}`,
                  expiresAt,
                },
                ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK, SK: 'METADATA' },
                UpdateExpression:
                  'SET updatedAt = :updatedAt, version = :nextVersion, expiresAt = :expiresAt',
                ConditionExpression: 'version = :version AND #status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':updatedAt': message.createdAt,
                  ':nextVersion': expectedVersion + 1,
                  ':expiresAt': expiresAt,
                  ':version': expectedVersion,
                  ':status': 'COLLECTING_REQUIREMENTS',
                },
              },
            },
          ],
        }),
      );
    } catch (error: unknown) {
      if (this.isConditional(error)) throw new ConditionalWriteConflictError();
      throw error;
    }
    const metadata = await this.getMetadata(sessionId);
    if (!metadata) throw new ConditionalWriteConflictError();
    return metadata;
  }
  public async updateTripAndAppendMessage(
    sessionId: string,
    trip: Trip,
    message: SessionMessage,
    expectedVersion: number,
    expiresAt: number,
  ): Promise<SessionMetadata> {
    const PK = partitionKey(sessionId);
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  ...message,
                  PK,
                  SK: `MESSAGE#${message.createdAt}#${message.messageId}`,
                  expiresAt,
                },
                ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: { ...trip, PK, SK: 'TRIP', expiresAt },
                ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK, SK: 'METADATA' },
                UpdateExpression:
                  'SET updatedAt = :updatedAt, version = :nextVersion, #status = :status, expiresAt = :expiresAt',
                ConditionExpression: 'version = :version AND #status = :oldStatus',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                  ':updatedAt': message.createdAt,
                  ':nextVersion': expectedVersion + 1,
                  ':expiresAt': expiresAt,
                  ':version': expectedVersion,
                  ':oldStatus': 'COLLECTING_REQUIREMENTS',
                  ':status': trip.status,
                },
              },
            },
          ],
        }),
      );
    } catch (error: unknown) {
      if (this.isConditional(error)) throw new ConditionalWriteConflictError();
      throw error;
    }
    const metadata = await this.getMetadata(sessionId);
    if (!metadata) throw new ConditionalWriteConflictError();
    return metadata;
  }
  public async getMetadata(sessionId: string): Promise<SessionMetadata | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: partitionKey(sessionId), SK: 'METADATA' },
      }),
    );
    const item = response.Item as MetadataRecord | undefined;
    return (
      item && {
        sessionId: item.sessionId,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        version: item.version,
      }
    );
  }
  public async getMessages(sessionId: string, cursor?: string): Promise<MessagePage> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': partitionKey(sessionId), ':prefix': 'MESSAGE#' },
        ScanIndexForward: false,
        Limit: 50,
        ...(cursor ? { ExclusiveStartKey: decodeCursor(cursor) } : {}),
      }),
    );
    const messages = ((response.Items as MessageRecord[] | undefined) ?? []).map(
      ({ messageId, role, content, createdAt }) => ({ messageId, role, content, createdAt }),
    );
    return {
      messages,
      ...(response.LastEvaluatedKey ? { nextCursor: encodeCursor(response.LastEvaluatedKey) } : {}),
    };
  }
  public async getTrip(sessionId: string): Promise<Trip | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: partitionKey(sessionId), SK: 'TRIP' },
      }),
    );
    const item = response.Item as TripRecord | undefined;
    return (
      item && {
        sessionId: item.sessionId,
        status: item.status,
        requirements: item.requirements,
        ...(item.recommendation ? { recommendation: item.recommendation } : {}),
        ...(item.failure ? { failure: item.failure } : {}),
      }
    );
  }
  private isConditional(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error.name === 'TransactionCanceledException' ||
        error.name === 'ConditionalCheckFailedException')
    );
  }
}
