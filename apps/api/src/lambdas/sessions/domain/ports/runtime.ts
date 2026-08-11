export interface Clock { now(): Date; }
export interface IdGenerator { uuid(): string; }
export interface Telemetry {
  span<T>(tool: string, fields: { readonly requestId: string; readonly sessionId?: string }, action: () => Promise<T>): Promise<T>;
}
