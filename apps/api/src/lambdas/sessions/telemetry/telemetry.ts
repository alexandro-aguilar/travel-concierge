import type { Telemetry } from '../domain/ports/runtime.js';

export class StructuredTelemetry implements Telemetry {
  public async span<T>(tool: string, fields: { readonly requestId: string; readonly sessionId?: string }, action: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const result = await action();
      this.log({ ...fields, agent: 'sessions', tool, durationMs: Date.now() - started, status: 'success' });
      return result;
    } catch (error: unknown) {
      this.log({ ...fields, agent: 'sessions', tool, durationMs: Date.now() - started, status: 'error' });
      throw error;
    }
  }
  private log(event: object): void { console.log(JSON.stringify(event)); }
}
