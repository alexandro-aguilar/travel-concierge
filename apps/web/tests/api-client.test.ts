import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, SessionApiClient } from '../src/api/client';

describe('SessionApiClient', () => {
  it('rejects malformed successful response bodies defensively', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 })),
    );
    await expect(
      new SessionApiClient('https://api.example').createSession(),
    ).rejects.toBeInstanceOf(ApiClientError);
  });
  it('keeps a safe API request id on error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'CONFLICT',
            message: 'The session cannot be updated',
            requestId: 'request-1',
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(
      new SessionApiClient('https://api.example').approve('00000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ requestId: 'request-1' });
  });
});
