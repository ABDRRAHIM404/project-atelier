import type {
  ErrorTelemetryEvent,
  MetricTelemetryEvent,
  TelemetryPorts,
  TraceTelemetryEvent,
} from '../../modules/audit-and-operations';
import { getCorrelationContext } from './correlation-context';
import { safeErrorCategory, safeTelemetryName, sanitizeTelemetryAttributes } from './redaction';
import { systemTimestamp, type TimestampFactory } from './time';

type Operation<Value> = () => Promise<Value> | Value;

export interface SafeTelemetry {
  captureError(name: string, error: unknown, attributes?: unknown): Promise<void>;
  recordMetric(name: string, value: number, attributes?: unknown): Promise<void>;
  observe<Value>(name: string, operation: Operation<Value>, attributes?: unknown): Promise<Value>;
}

async function ignoreTelemetryFailure(operation: () => PromiseLike<void> | void): Promise<void> {
  try {
    await operation();
  } catch {
    // Telemetry is operational evidence, never the authoritative business action.
  }
}

function safelyReadMonotonicTime(monotonicNow: () => number): number | undefined {
  try {
    const value = monotonicNow();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function createSafeTelemetry(
  ports: TelemetryPorts,
  timestamp: TimestampFactory = systemTimestamp,
  monotonicNow: () => number = performance.now.bind(performance),
): SafeTelemetry {
  async function captureError(name: string, error: unknown, attributes?: unknown): Promise<void> {
    await ignoreTelemetryFailure(async () => {
      const correlation = getCorrelationContext();
      const event: ErrorTelemetryEvent = Object.freeze({
        attributes: sanitizeTelemetryAttributes(attributes),
        ...(correlation ? { correlationId: correlation.correlationId } : {}),
        errorCategory: safeErrorCategory(error),
        name: safeTelemetryName(name, 'invalid_error_name'),
        timestamp: timestamp(),
      });

      await ports.errors.capture(event, error);
    });
  }

  async function recordTrace(
    name: string,
    outcome: TraceTelemetryEvent['outcome'],
    durationMs: number,
    attributes?: unknown,
  ): Promise<void> {
    await ignoreTelemetryFailure(async () => {
      const correlation = getCorrelationContext();
      const event: TraceTelemetryEvent = Object.freeze({
        attributes: sanitizeTelemetryAttributes(attributes),
        ...(correlation ? { correlationId: correlation.correlationId } : {}),
        durationMs: Math.max(0, durationMs),
        name: safeTelemetryName(name, 'invalid_trace_name'),
        outcome,
        timestamp: timestamp(),
      });

      await ports.traces.record(event);
    });
  }

  return Object.freeze({
    captureError,
    async recordMetric(name: string, value: number, attributes?: unknown): Promise<void> {
      await ignoreTelemetryFailure(async () => {
        if (!Number.isFinite(value)) {
          return;
        }

        const correlation = getCorrelationContext();
        const event: MetricTelemetryEvent = Object.freeze({
          attributes: sanitizeTelemetryAttributes(attributes),
          ...(correlation ? { correlationId: correlation.correlationId } : {}),
          name: safeTelemetryName(name, 'invalid_metric_name'),
          timestamp: timestamp(),
          value,
        });

        await ports.metrics.record(event);
      });
    },
    async observe<Value>(
      name: string,
      operation: Operation<Value>,
      attributes?: unknown,
    ): Promise<Value> {
      const startedAt = safelyReadMonotonicTime(monotonicNow);

      try {
        const value = await operation();
        const completedAt = safelyReadMonotonicTime(monotonicNow);
        const durationMs =
          startedAt === undefined || completedAt === undefined ? 0 : completedAt - startedAt;
        await recordTrace(name, 'success', durationMs, attributes);
        return value;
      } catch (error) {
        await captureError(name, error, attributes);
        const completedAt = safelyReadMonotonicTime(monotonicNow);
        const durationMs =
          startedAt === undefined || completedAt === undefined ? 0 : completedAt - startedAt;
        await recordTrace(name, 'failure', durationMs, attributes);
        throw error;
      }
    },
  });
}
