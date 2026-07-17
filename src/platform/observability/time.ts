import { utcInstantFromDate, type UtcInstant } from '../../shared/kernel';

export type TimestampFactory = () => UtcInstant;

export const systemTimestamp: TimestampFactory = () => {
  const instant = utcInstantFromDate(new Date());

  if (!instant.ok) {
    throw new Error('The runtime clock produced an invalid timestamp.');
  }

  return instant.value;
};
