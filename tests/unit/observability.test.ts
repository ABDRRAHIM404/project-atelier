import { describe, expect, it, vi } from 'vitest';

import type {
  ErrorTelemetryEvent,
  MetricTelemetryEvent,
  StructuredLogEntry,
  TelemetryPorts,
  TraceTelemetryEvent,
} from '../../src/modules/audit-and-operations';
import {
  createCorrelationId,
  createSafeLogger,
  createSafeTelemetry,
  getCorrelationContext,
  runWithCorrelation,
  sanitizeTelemetryAttributes,
} from '../../src/platform/observability';
import { parseUtcInstant } from '../../src/shared/kernel';

function fixedTimestamp() {
  const result = parseUtcInstant('2026-07-16T12:00:00.000Z');
  if (!result.ok) {
    throw new Error('Test timestamp must be valid.');
  }

  return result.value;
}

describe('correlation context', () => {
  it('propagates across asynchronous work and restores nested context', async () => {
    const outer = createCorrelationId();
    const inner = createCorrelationId();

    await runWithCorrelation({ correlationId: outer }, async () => {
      await Promise.resolve();
      expect(getCorrelationContext()?.correlationId).toBe(outer);

      runWithCorrelation({ correlationId: inner }, () => {
        expect(getCorrelationContext()?.correlationId).toBe(inner);
      });

      expect(getCorrelationContext()?.correlationId).toBe(outer);
    });

    expect(getCorrelationContext()).toBeUndefined();
  });

  it('isolates concurrent operations', async () => {
    const first = createCorrelationId();
    const second = createCorrelationId();

    const values = await Promise.all([
      runWithCorrelation({ correlationId: first }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getCorrelationContext()?.correlationId;
      }),
      runWithCorrelation({ correlationId: second }, async () => {
        await Promise.resolve();
        return getCorrelationContext()?.correlationId;
      }),
    ]);

    expect(values).toEqual([first, second]);
  });
});

describe('safe structured logging', () => {
  it('keeps only allowlisted categorical context and never serializes error content', async () => {
    const entries: StructuredLogEntry[] = [];
    const logger = createSafeLogger({ write: (entry) => void entries.push(entry) }, fixedTimestamp);
    const correlationId = createCorrelationId();
    const secret = 'do-not-log-this-secret';

    await runWithCorrelation({ correlationId }, () =>
      logger.write({
        attributes: {
          actorType: 'customer',
          email: secret,
          operation: 'project.submit',
          payload: { token: secret },
          release: 'git:abc123',
        },
        error: new Error(secret),
        event: 'project.submit.failed',
        level: 'error',
      }),
    );

    expect(entries).toEqual([
      {
        attributes: {
          actorType: 'customer',
          operation: 'project.submit',
          redactedFieldCount: 2,
          release: 'git:abc123',
        },
        correlationId,
        errorCategory: 'Error',
        event: 'project.submit.failed',
        level: 'error',
        timestamp: '2026-07-16T12:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain(secret);
  });

  it('isolates logging sink failures from callers', async () => {
    const logger = createSafeLogger(
      {
        write: () => {
          throw new Error('sink unavailable');
        },
      },
      fixedTimestamp,
    );

    await expect(
      logger.write({ event: 'operation.completed', level: 'info' }),
    ).resolves.toBeUndefined();
  });

  it('rejects nested, uncontrolled, invalid, and non-finite attributes', () => {
    expect(
      sanitizeTelemetryAttributes({
        latencyMs: 12,
        module: 'orders',
        note: 'customer controlled text',
        operation: 'contains whitespace',
        token: 'secret',
      }),
    ).toEqual({ latencyMs: 12, module: 'orders', redactedFieldCount: 3 });
  });
});

describe('failure-isolated telemetry ports', () => {
  function capturePorts(): {
    errors: ErrorTelemetryEvent[];
    exceptions: unknown[];
    metrics: MetricTelemetryEvent[];
    ports: TelemetryPorts;
    traces: TraceTelemetryEvent[];
  } {
    const errors: ErrorTelemetryEvent[] = [];
    const exceptions: unknown[] = [];
    const metrics: MetricTelemetryEvent[] = [];
    const traces: TraceTelemetryEvent[] = [];

    return {
      errors,
      exceptions,
      metrics,
      ports: {
        errors: {
          capture: (event, exception) => {
            errors.push(event);
            exceptions.push(exception);
          },
        },
        metrics: { record: (event) => void metrics.push(event) },
        traces: { record: (event) => void traces.push(event) },
      },
      traces,
    };
  }

  it('records safe metrics, spans, errors, and propagated correlation', async () => {
    const captured = capturePorts();
    const times = [10, 25, 30, 50];
    const telemetry = createSafeTelemetry(
      captured.ports,
      fixedTimestamp,
      () => times.shift() ?? 50,
    );
    const correlationId = createCorrelationId();

    await runWithCorrelation({ correlationId }, async () => {
      await telemetry.recordMetric('queue.depth', 2, { module: 'notifications' });
      await expect(
        telemetry.observe('project.submit', () => 'complete', { actorType: 'customer' }),
      ).resolves.toBe('complete');

      const businessError = new Error('private business failure');
      await expect(
        telemetry.observe('project.fail', () => {
          throw businessError;
        }),
      ).rejects.toBe(businessError);
    });

    expect(captured.metrics[0]).toMatchObject({ correlationId, name: 'queue.depth', value: 2 });
    expect(captured.traces).toEqual([
      {
        attributes: { actorType: 'customer' },
        correlationId,
        durationMs: 15,
        name: 'project.submit',
        outcome: 'success',
        timestamp: '2026-07-16T12:00:00.000Z',
      },
      {
        attributes: {},
        correlationId,
        durationMs: 20,
        name: 'project.fail',
        outcome: 'failure',
        timestamp: '2026-07-16T12:00:00.000Z',
      },
    ]);
    expect(captured.errors[0]).toMatchObject({
      correlationId,
      errorCategory: 'Error',
      name: 'project.fail',
    });
    expect(captured.exceptions[0]).toBeInstanceOf(Error);
    expect(JSON.stringify(captured.errors)).not.toContain('private business failure');
  });

  it('never changes a business result when every telemetry provider fails', async () => {
    const failingPort = vi.fn(() => {
      throw new Error('telemetry unavailable');
    });
    const telemetry = createSafeTelemetry(
      {
        errors: { capture: failingPort },
        metrics: { record: failingPort },
        traces: { record: failingPort },
      },
      fixedTimestamp,
      () => 1,
    );

    await expect(telemetry.recordMetric('metric', 1)).resolves.toBeUndefined();
    await expect(telemetry.captureError('error', new Error('private'))).resolves.toBeUndefined();
    await expect(telemetry.observe('operation', () => 42)).resolves.toBe(42);

    const businessError = new Error('business outcome');
    await expect(
      telemetry.observe('operation', () => {
        throw businessError;
      }),
    ).rejects.toBe(businessError);
  });

  it('isolates timestamp and monotonic-clock failures around an operation', async () => {
    const captured = capturePorts();
    const telemetry = createSafeTelemetry(
      captured.ports,
      () => {
        throw new Error('clock unavailable');
      },
      () => {
        throw new Error('monotonic clock unavailable');
      },
    );

    await expect(telemetry.recordMetric('metric', 1)).resolves.toBeUndefined();
    await expect(telemetry.captureError('error', new Error('business'))).resolves.toBeUndefined();
    await expect(telemetry.observe('operation', () => 42)).resolves.toBe(42);
  });
});
