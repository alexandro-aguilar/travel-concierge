import { ZodError, type ZodType } from 'zod';
import {
  apiErrorSchema,
  approvalResponseSchema,
  messageResponseSchema,
  sessionSchema,
  tripSchema,
  type ApprovalResponse,
  type MessageResponse,
  type Session,
  type Trip,
} from './contracts';

export class ApiClientError extends Error {
  public constructor(
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}
export class SessionApiClient {
  public constructor(private readonly baseUrl = import.meta.env.VITE_API_BASE_URL ?? '') {}
  public createSession(): Promise<Pick<Session, 'sessionId' | 'status' | 'createdAt'>> {
    return this.request(
      '/sessions',
      { method: 'POST' },
      sessionSchema.pick({ sessionId: true, status: true, createdAt: true }),
    );
  }
  public getSession(sessionId: string): Promise<Session> {
    return this.request(`/sessions/${sessionId}`, {}, sessionSchema);
  }
  public getTrip(sessionId: string): Promise<Trip> {
    return this.request(`/sessions/${sessionId}/trip`, {}, tripSchema);
  }
  public sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
    return this.request(
      `/sessions/${sessionId}/messages`,
      { method: 'POST', body: JSON.stringify({ message }) },
      messageResponseSchema,
    );
  }
  public approve(sessionId: string): Promise<ApprovalResponse> {
    return this.request(
      `/sessions/${sessionId}/approve`,
      { method: 'POST', body: JSON.stringify({ approval: true }) },
      approvalResponseSchema,
    );
  }
  private async request<T>(path: string, init: RequestInit, schema: ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...init.headers },
      });
    } catch {
      throw new ApiClientError(
        'Unable to reach the concierge. Check your connection and try again.',
      );
    }
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.message : 'The concierge could not complete that request.',
        parsed.success ? parsed.data.requestId : undefined,
      );
    }
    try {
      return schema.parse(payload);
    } catch (error: unknown) {
      if (error instanceof ZodError)
        throw new ApiClientError(
          'The concierge returned an unexpected response. Please reload and try again.',
        );
      throw error;
    }
  }
}
