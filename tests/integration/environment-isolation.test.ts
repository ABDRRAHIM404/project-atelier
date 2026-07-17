import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createIsolatedTestDirectory } from '../support/isolated-test-environment';

describe('integration environment isolation', () => {
  it('creates unique disposable workspaces under the operating-system temp directory', async () => {
    const first = await createIsolatedTestDirectory();
    const second = await createIsolatedTestDirectory();

    try {
      expect(first.path).not.toBe(second.path);
      expect(relative(tmpdir(), first.path)).toMatch(/^project-atelier-test-/u);
      expect(relative(tmpdir(), second.path)).toMatch(/^project-atelier-test-/u);
      await expect(access(first.path)).resolves.toBeUndefined();
      await expect(access(second.path)).resolves.toBeUndefined();
    } finally {
      await Promise.all([first.dispose(), second.dispose()]);
    }

    await expect(access(first.path)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(second.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('allows cleanup to be retried safely', async () => {
    const workspace = await createIsolatedTestDirectory();

    await workspace.dispose();
    await expect(workspace.dispose()).resolves.toBeUndefined();
  });
});
