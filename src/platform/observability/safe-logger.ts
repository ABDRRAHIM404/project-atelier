import type {
  LogSink,
  StructuredLogEntry,
  TelemetryAttributes,
} from '../../modules/audit-and-operations';
import { getCorrelationContext } from './correlation-context';
import { safeErrorCategory, safeTelemetryName, sanitizeTelemetryAttributes } from './redaction';
import { systemTimestamp, type TimestampFactory } from './time';

export type LogRequest = Readonly<{
  attributes?: unknown;
  error?: unknown;
  event: string;
  level: StructuredLogEntry['level'];
}>;

export interface SafeLogger {
  write(request: LogRequest): Promise<void>;
}

export function createSafeLogger(
  sink: LogSink,
  timestamp: TimestampFactory = systemTimestamp,
): SafeLogger {
  return Object.freeze({
    async write(request: LogRequest): Promise<void> {
      try {
        const correlation = getCorrelationContext();
        const attributes: TelemetryAttributes = sanitizeTelemetryAttributes(request.attributes);
        const entry: StructuredLogEntry = Object.freeze({
          attributes,
          ...(correlation ? { correlationId: correlation.correlationId } : {}),
          ...(request.error === undefined
            ? {}
            : { errorCategory: safeErrorCategory(request.error) }),
          event: safeTelemetryName(request.event, 'invalid_event_name'),
          level: request.level,
          timestamp: timestamp(),
        });

        await sink.write(entry);
      } catch {
        // Logger construction and delivery must not become a business success condition.
      }
    },
  });
}
