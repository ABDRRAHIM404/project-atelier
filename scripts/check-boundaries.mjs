import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const MODULE_LAYERS = new Set(['application', 'domain', 'infrastructure', 'ports', 'presentation']);
const PROVIDER_OR_FRAMEWORK_PACKAGES = [
  '@aws-sdk/',
  '@clerk/',
  '@opentelemetry/',
  '@sentry/',
  'drizzle-orm',
  'next',
  'react',
  'react-dom',
  'resend',
];

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function classify(filePath) {
  const normalized = normalizePath(filePath);
  const sourceIndex = normalized.lastIndexOf('/src/');
  const relative = sourceIndex >= 0 ? normalized.slice(sourceIndex + 5) : normalized;
  const parts = relative.split('/');

  if (parts[0] === 'modules' && parts[1]) {
    const layer = MODULE_LAYERS.has(parts[2]) ? parts[2] : 'public';
    return { area: 'module', layer, moduleName: parts[1] };
  }

  return { area: parts[0] ?? 'unknown', layer: undefined, moduleName: undefined };
}

function packageMatches(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(packageName);
}

function isProviderOrFramework(specifier) {
  return PROVIDER_OR_FRAMEWORK_PACKAGES.some((packageName) =>
    packageMatches(specifier, packageName),
  );
}

function aliasToSourcePath(specifier, projectRoot) {
  if (!specifier.startsWith('@/')) {
    return undefined;
  }

  return path.join(projectRoot, 'src', specifier.slice(2));
}

function relativeToSourcePath(specifier, sourcePath) {
  if (!specifier.startsWith('.')) {
    return undefined;
  }

  return path.resolve(path.dirname(sourcePath), specifier);
}

function targetClassification(specifier, sourcePath, projectRoot) {
  const targetPath =
    aliasToSourcePath(specifier, projectRoot) ?? relativeToSourcePath(specifier, sourcePath);
  return targetPath ? classify(targetPath) : undefined;
}

function isModuleRootImport(specifier, moduleName) {
  return specifier === `@/modules/${moduleName}` || specifier === `@/modules/${moduleName}/index`;
}

function violation(message, sourcePath, specifier, line) {
  return { line, message, sourcePath: normalizePath(sourcePath), specifier };
}

function evaluateImport({ projectRoot, source, sourcePath, specifier, line }) {
  const target = targetClassification(specifier, sourcePath, projectRoot);
  const violations = [];

  if (source.area === 'shared') {
    if (
      isProviderOrFramework(specifier) ||
      target?.area === 'app' ||
      target?.area === 'modules' ||
      target?.area === 'module' ||
      target?.area === 'platform'
    ) {
      violations.push(
        violation(
          'Shared code must remain provider-, framework-, application-, and module-neutral.',
          sourcePath,
          specifier,
          line,
        ),
      );
    }
    return violations;
  }

  if (source.area === 'app' && target?.area === 'module') {
    if (!isModuleRootImport(specifier, target.moduleName)) {
      violations.push(
        violation(
          'App Router adapters may import only a module public root contract.',
          sourcePath,
          specifier,
          line,
        ),
      );
    }
    return violations;
  }

  if (source.area !== 'module') {
    return violations;
  }

  const restrictedPureLayer = ['application', 'domain', 'ports'].includes(source.layer);
  if (restrictedPureLayer && isProviderOrFramework(specifier)) {
    violations.push(
      violation(
        `${source.layer} code cannot import framework or provider SDK types.`,
        sourcePath,
        specifier,
        line,
      ),
    );
  }

  if (target?.area === 'module' && target.moduleName !== source.moduleName) {
    if (!isModuleRootImport(specifier, target.moduleName)) {
      violations.push(
        violation(
          'Cross-module imports must use the target module public root contract.',
          sourcePath,
          specifier,
          line,
        ),
      );
    }
    return violations;
  }

  if (target?.area !== 'module' || target.moduleName !== source.moduleName) {
    return violations;
  }

  const disallowedTargetsByLayer = {
    application: new Set(['infrastructure', 'presentation']),
    domain: new Set(['application', 'infrastructure', 'ports', 'presentation']),
    ports: new Set(['application', 'infrastructure', 'presentation']),
    public: new Set(['infrastructure', 'presentation']),
  };
  const disallowedTargets = disallowedTargetsByLayer[source.layer];

  if (disallowedTargets?.has(target.layer)) {
    violations.push(
      violation(
        `${source.layer} code cannot depend on its module ${target.layer} layer.`,
        sourcePath,
        specifier,
        line,
      ),
    );
  }

  return violations;
}

export function validateSourceText({ projectRoot, sourcePath, sourceText }) {
  const scriptKind = sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const source = classify(sourcePath);
  const violations = [];

  function inspect(node) {
    let specifierNode;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifierNode = node.moduleSpecifier;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      specifierNode = node.arguments[0];
    }

    if (specifierNode && ts.isStringLiteralLike(specifierNode)) {
      const position = sourceFile.getLineAndCharacterOfPosition(specifierNode.getStart(sourceFile));
      violations.push(
        ...evaluateImport({
          line: position.line + 1,
          projectRoot,
          source,
          sourcePath,
          specifier: specifierNode.text,
        }),
      );
    }

    ts.forEachChild(node, inspect);
  }

  inspect(sourceFile);
  return violations;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function findBoundaryViolations(projectRoot) {
  const sourceRoot = path.join(projectRoot, 'src');
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const violations = [];

  for (const sourcePath of sourceFiles) {
    const sourceText = await readFile(sourcePath, 'utf8');
    violations.push(...validateSourceText({ projectRoot, sourcePath, sourceText }));
  }

  return violations;
}

async function runCli() {
  const projectRoot = process.cwd();
  const violations = await findBoundaryViolations(projectRoot);

  if (violations.length > 0) {
    for (const item of violations) {
      process.stderr.write(
        `${item.sourcePath}:${item.line} ${item.message} Import: ${item.specifier}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write('Module boundary validation passed.\n');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await runCli();
}
