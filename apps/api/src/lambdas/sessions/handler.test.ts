import { describe, expect, it } from 'vitest';
import { AppendMessageHandler } from './commands/append-message/handler.js';
import { CreateSessionHandler } from './commands/create-session/handler.js';
import { GetSessionHandler } from './queries/get-session/handler.js';
import { GetTripHandler } from './queries/get-trip/handler.js';
import { createHandler } from './handler.js';
import { clock, ids, InMemorySessionRepository, telemetry } from './tests/fakes.js';

const event = (method: string, rawPath: string, body: string | null = null) => ({ version: '2.0', routeKey: '$default', rawPath, rawQueryString: '', headers: {}, requestContext: { accountId: 'a', apiId: 'a', domainName: 'a', domainPrefix: 'a', http: { method, path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' }, requestId: 'request-1', routeKey: '$default', stage: '$default', time: '', timeEpoch: 0 }, isBase64Encoded: false, body });
describe('sessions HTTP handler', () => {
  const dependencies = () => { const repository = new InMemorySessionRepository(); const generator = ids('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'); return { create: new CreateSessionHandler(repository, clock(), generator, 30, telemetry), append: new AppendMessageHandler(repository, clock(), generator, 30, telemetry), getSession: new GetSessionHandler(repository, telemetry), getTrip: new GetTripHandler(repository, telemetry) }; };
  it('creates a session and returns its public contract', async () => { const result = await createHandler(dependencies())(event('POST', '/sessions'), {} as never, () => undefined); expect(result?.statusCode).toBe(201); expect(JSON.parse(result?.body ?? '')).toMatchObject({ status: 'COLLECTING_REQUIREMENTS' }); });
  it('trims accepted messages and rejects malformed or oversized input', async () => { const deps = dependencies(); const handler = createHandler(deps); await handler(event('POST', '/sessions'), {} as never, () => undefined); const ok = await handler(event('POST', '/sessions/00000000-0000-4000-8000-000000000001/messages', '{"message":"  hello  "}'), {} as never, () => undefined); expect(JSON.parse(ok?.body ?? '').message.content).toBe('hello'); const bad = await handler(event('POST', '/sessions/00000000-0000-4000-8000-000000000001/messages', '{'), {} as never, () => undefined); expect(bad?.statusCode).toBe(400); });
  it('returns safe 404 and 500 error contracts', async () => { const result = await createHandler(dependencies())(event('GET', '/sessions/00000000-0000-4000-8000-000000000001/trip'), {} as never, () => undefined); expect(result?.statusCode).toBe(404); expect(JSON.parse(result?.body ?? '')).toEqual({ code: 'SESSION_NOT_FOUND', message: 'Session not found', requestId: 'request-1' }); });
});
