import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { AppendMessageHandler } from './commands/append-message/handler.js';
import { CreateSessionHandler } from './commands/create-session/handler.js';
import { createSessionsContainer, sessionsTypes } from './composition-root.js';
import { ConditionalWriteConflictError, InvalidCursorError, InvalidTripStateError, SessionNotFoundError } from './domain/errors/errors.js';
import { GetSessionHandler } from './queries/get-session/handler.js';
import { GetTripHandler } from './queries/get-trip/handler.js';

const sessionIdSchema = z.uuid();
const messageSchema = z.object({ message: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(4000)) }).strict();
const cursorSchema = z.string().min(1).max(4096);
type Dependencies = { readonly create: CreateSessionHandler; readonly append: AppendMessageHandler; readonly getSession: GetSessionHandler; readonly getTrip: GetTripHandler; };
const defaultContainer = createSessionsContainer({ tableName: process.env.SESSIONS_TABLE_NAME ?? 'travel-concierge-sessions', ttlDays: Number(process.env.SESSION_TTL_DAYS ?? 30), region: process.env.AWS_REGION ?? 'us-east-1', endpoint: process.env.LOCALSTACK_ENDPOINT });
const defaultDependencies: Dependencies = { create: defaultContainer.get(sessionsTypes.create), append: defaultContainer.get(sessionsTypes.append), getSession: defaultContainer.get(sessionsTypes.getSession), getTrip: defaultContainer.get(sessionsTypes.getTrip) };
const response = (statusCode: number, body: object) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const errorResponse = (requestId: string, error: unknown) => {
  if (error instanceof z.ZodError || error instanceof InvalidCursorError) return response(400, { code: 'INVALID_REQUEST', message: 'The request is invalid', requestId });
  if (error instanceof SessionNotFoundError) return response(404, { code: 'SESSION_NOT_FOUND', message: 'Session not found', requestId });
  if (error instanceof InvalidTripStateError || error instanceof ConditionalWriteConflictError) return response(409, { code: 'CONFLICT', message: 'The session cannot be updated', requestId });
  return response(500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId });
};
const parseBody = (body: string | null): unknown => { try { return JSON.parse(body ?? ''); } catch { throw new z.ZodError([]); } };

export const createHandler = (dependencies: Dependencies): APIGatewayProxyHandlerV2 => async (event) => {
  const requestId = event.requestContext.requestId || 'unknown';
  try {
    const path = event.rawPath;
    if (event.requestContext.http.method === 'POST' && path === '/sessions') return response(201, await dependencies.create.execute(requestId));
    const match = /^\/sessions\/([^/]+)(\/messages|\/trip)?$/.exec(path);
    if (!match) return response(400, { code: 'INVALID_REQUEST', message: 'The request is invalid', requestId });
    const sessionId = sessionIdSchema.parse(match[1]);
    if (event.requestContext.http.method === 'POST' && match[2] === '/messages') {
      const { message } = messageSchema.parse(parseBody(event.body));
      return response(200, await dependencies.append.execute(requestId, sessionId, message));
    }
    if (event.requestContext.http.method === 'GET' && match[2] === '/trip') return response(200, await dependencies.getTrip.execute(requestId, sessionId));
    if (event.requestContext.http.method === 'GET' && !match[2]) {
      const cursor = event.queryStringParameters?.cursor === undefined ? undefined : cursorSchema.parse(event.queryStringParameters.cursor);
      return response(200, await dependencies.getSession.execute(requestId, sessionId, cursor));
    }
    return response(400, { code: 'INVALID_REQUEST', message: 'The request is invalid', requestId });
  } catch (error: unknown) { return errorResponse(requestId, error); }
};
export const handler = createHandler(defaultDependencies);
