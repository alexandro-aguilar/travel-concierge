export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  uuid(): string;
}
export interface Telemetry {
  span<T>(tool: string, fields: TelemetryFields, action: () => Promise<T>): Promise<T>;
}
export interface TelemetryFields {
  readonly requestId: string;
  readonly sessionId?: string;
  readonly failureCategory?: string;
  readonly retryCount?: number;
  readonly modelId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly recommendationCompleteness?: 'complete' | 'degraded' | 'incomplete';
  readonly approvalOutcome?: 'approved' | 'conflict' | 'invalid';
}
