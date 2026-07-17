import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { parseIdentifier, type Identifier } from '../../shared/kernel';

export type CorrelationId = Identifier<'Correlation'>;

export type CorrelationContext = Readonly<{
  correlationId: CorrelationId;
}>;

const storage = new AsyncLocalStorage<CorrelationContext>();

export function createCorrelationId(): CorrelationId {
  const parsed = parseIdentifier<'Correlation'>(randomUUID());

  if (!parsed.ok) {
    throw new Error('The runtime generated an invalid correlation identifier.');
  }

  return parsed.value;
}

export function runWithCorrelation<Value>(
  context: CorrelationContext,
  operation: () => Value,
): Value {
  return storage.run(Object.freeze({ ...context }), operation);
}

export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}
