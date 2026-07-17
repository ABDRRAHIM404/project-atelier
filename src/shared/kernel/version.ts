import { err, ok, type Result } from './result';

declare const recordVersionBrand: unique symbol;

export type RecordVersion = number & {
  readonly [recordVersionBrand]: 'RecordVersion';
};

export type VersionFailure = Readonly<{
  code: 'INVALID_RECORD_VERSION' | 'RECORD_VERSION_OVERFLOW';
}>;

export function parseRecordVersion(candidate: number): Result<RecordVersion, VersionFailure> {
  if (!Number.isSafeInteger(candidate) || candidate < 1) {
    return err({ code: 'INVALID_RECORD_VERSION' });
  }

  return ok(candidate as RecordVersion);
}

export function nextRecordVersion(current: RecordVersion): Result<RecordVersion, VersionFailure> {
  if (current === Number.MAX_SAFE_INTEGER) {
    return err({ code: 'RECORD_VERSION_OVERFLOW' });
  }

  return ok((current + 1) as RecordVersion);
}
