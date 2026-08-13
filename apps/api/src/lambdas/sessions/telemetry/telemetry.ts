import { Logger } from '@aws-lambda-powertools/logger';
import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type { Telemetry, TelemetryFields } from '../domain/ports/runtime.js';

const forbiddenKeys = new Set([
  'authorization',
  'credentials',
  'headers',
  'message',
  'prompt',
  'providerPayload',
  'modelPayload',
  'rawResponse',
  'secret',
  'secretId',
  'stack',
  'error',
]);

export const sanitizeTelemetryFields = (fields: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) =>
        !forbiddenKeys.has(key) &&
        value !== undefined &&
        (typeof value !== 'object' || value === null),
    ),
  );

export class StructuredTelemetry implements Telemetry {
  private readonly logger = new Logger({ serviceName: 'travel-concierge-sessions' });
  private readonly metrics = new Metrics({ namespace: 'TravelConcierge', serviceName: 'sessions' });
  private readonly tracer = new Tracer({ serviceName: 'travel-concierge-sessions' });

  public async span<T>(
    tool: string,
    fields: TelemetryFields,
    action: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await action();
      this.emit(tool, fields, 'success', Date.now() - started);
      return result;
    } catch (error: unknown) {
      this.emit(tool, fields, 'error', Date.now() - started);
      throw error;
    }
  }
  private emit(
    tool: string,
    fields: TelemetryFields,
    status: 'success' | 'error',
    durationMs: number,
  ): void {
    const event = sanitizeTelemetryFields({
      ...fields,
      agent: 'sessions',
      tool,
      durationMs,
      status,
    });
    this.tracer.putAnnotation('tool', tool);
    this.tracer.putAnnotation('status', status);
    this.metrics.addMetric('WorkflowLatency', MetricUnit.Milliseconds, durationMs);
    if (tool === 'booking.simulation') {
      this.metrics.addMetric('ApprovalAttempts', MetricUnit.Count, 1);
      this.metrics.addMetric(
        status === 'success' ? 'ApprovalOutcomes' : 'ApprovalConflicts',
        MetricUnit.Count,
        1,
      );
    }
    if (status === 'error' && fields.failureCategory)
      this.metrics.addMetric('ProviderFailures', MetricUnit.Count, 1);
    this.logger.info('sessions telemetry', event);
  }
}
