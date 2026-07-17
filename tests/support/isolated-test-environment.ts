import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const TEST_DIRECTORY_PREFIX = 'project-atelier-test-';

export function assertSafeTestEnvironment(
  environment: Readonly<NodeJS.ProcessEnv> = process.env,
): void {
  if (environment.APP_ENV === 'production' || environment.NODE_ENV === 'production') {
    throw new Error('Tests must not run with a production application environment.');
  }
}

export async function createIsolatedTestDirectory(): Promise<{
  dispose: () => Promise<void>;
  path: string;
}> {
  assertSafeTestEnvironment();

  const parent = tmpdir();
  const path = await mkdtemp(join(parent, TEST_DIRECTORY_PREFIX));
  const relativePath = relative(parent, path);

  if (relativePath.startsWith('..') || !relativePath.startsWith(TEST_DIRECTORY_PREFIX)) {
    await rm(path, { force: true, recursive: true });
    throw new Error(
      'Refusing to use a test directory outside the operating-system temp directory.',
    );
  }

  let disposed = false;

  return {
    path,
    dispose: async () => {
      if (disposed) {
        return;
      }

      disposed = true;
      await rm(path, { force: true, recursive: true });
    },
  };
}
