import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const scannableFilePattern =
  /(?:^|\/)(?:\.env\.example|[^/]+\.(?:css|env|js|json|jsx|md|mjs|ts|tsx|ya?ml))$/u;
const secretPatterns = Object.freeze([
  { id: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/gu },
  { id: 'github-token', pattern: /(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/gu },
  {
    id: 'private-key',
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/gu,
  },
  { id: 'stripe-secret', pattern: /sk_(?:live|test)_[A-Za-z0-9]{16,}/gu },
  {
    id: 'assigned-secret',
    pattern:
      /(?:PASSWORD|PRIVATE_KEY|SECRET|SERVICE_ROLE_KEY|TOKEN)\s*[:=]\s*["'][^"'\s]{8,}["']/giu,
  },
]);

export function findSecretFindings(content, options = {}) {
  const includeAssignedSecrets = options.includeAssignedSecrets ?? true;

  return secretPatterns.flatMap(({ id, pattern }) => {
    if (id === 'assigned-secret' && !includeAssignedSecrets) return [];
    pattern.lastIndex = 0;
    return [...content.matchAll(pattern)].map((match) => ({ id, index: match.index ?? 0 }));
  });
}

function repositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  );

  return output.split('\0').filter((file) => file.length > 0 && scannableFilePattern.test(file));
}

async function main() {
  const findings = [];
  const files = repositoryFiles();

  for (const file of files) {
    let content;
    try {
      content = await readFile(path.resolve(process.cwd(), file), 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const finding of findSecretFindings(content, {
      includeAssignedSecrets: !file.startsWith('tests/'),
    })) {
      findings.push(`${file}: ${finding.id}`);
    }
  }

  if (findings.length > 0) {
    console.error('Potential secrets detected (values intentionally omitted):');
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Secret scan passed across ${files.length} source/configuration files.`);
}

if (process.argv[1]?.endsWith('check-secrets.mjs')) {
  await main();
}
