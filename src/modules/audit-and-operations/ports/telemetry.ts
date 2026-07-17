import type { ProblemCode } from '../../../shared/errors';
import type { ActorKind, UtcInstant } from '../../../shared/kernel';

export type Awaitable<Value> = PromiseLike<Value> | Value;

export type TelemetryAttributeValue = boolean | number | string;

export type TelemetryAttributes = Readonly<
  Partial<{
    actorType: ActorKind;
    attempt: number;
    deviceClass: string;
    environment: string;
    errorCode: ProblemCode;
    latencyMs: number;
    locale: string;
    module: string;
    operation: string;
    outcome: 'failure' | 'rejected' | 'success';
    providerCategory: string;
    queueState: string;
    redactedFieldCount: number;
    release: string;
    resourceType: string;
    stateTransition: string;
  }>
>;

export type StructuredLogEntry = Readonly<{
  attributes: TelemetryAttributes;
  correlationId?: string;
  errorCategory?: string;
  event: string;
  level: 'debug' | 'error' | 'info' | 'warn';
  timestamp: UtcInstant;
}>;

export type ErrorTelemetryEvent = Readonly<{
  attributes: TelemetryAttributes;
  correlationId?: string;
  errorCategory: string;
  name: string;
  timestamp: UtcInstant;
}>;

export type MetricTelemetryEvent = Readonly<{
  attributes: TelemetryAttributes;
  correlationId?: string;
  name: string;
  timestamp: UtcInstant;
  value: number;
}>;

export type TraceTelemetryEvent = Readonly<{
  attributes: TelemetryAttributes;
  correlationId?: string;
  durationMs: number;
  name: string;
  outcome: 'failure' | 'success';
  timestamp: UtcInstant;
}>;

export interface LogSink {
  write(entry: StructuredLogEntry): Awaitable<void>;
}

/** Adapter seam for the approved Sentry error provider. */
export interface ErrorTelemetryPort {
  /**
   * `exception` is process-local input for provider-native grouping/causal chains.
   * Adapters must apply the approved PII/secret scrubbing before export.
   */
  capture(event: ErrorTelemetryEvent, exception: unknown): Awaitable<void>;
}

/** Adapter seam for OpenTelemetry/provider-native metrics. */
export interface MetricTelemetryPort {
  record(event: MetricTelemetryEvent): Awaitable<void>;
}

/** Adapter seam for OpenTelemetry spans and trace export. */
export interface TraceTelemetryPort {
  record(event: TraceTelemetryEvent): Awaitable<void>;
}

export type TelemetryPorts = Readonly<{
  errors: ErrorTelemetryPort;
  metrics: MetricTelemetryPort;
  traces: TraceTelemetryPort;
}>;
