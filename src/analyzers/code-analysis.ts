/**
 * Code Analysis for GID CLI
 *
 * Provides file signature extraction and pattern detection for graph enrichment.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface FunctionSignature {
  name: string;
  params: Array<{ name: string; type?: string }>;
  returnType?: string;
  async: boolean;
  exported: boolean;
  line: number;
}

export interface ClassSignature {
  name: string;
  extends?: string;
  implements?: string[];
  exported: boolean;
  methods: FunctionSignature[];
  properties: Array<{ name: string; type?: string; visibility?: string }>;
  line: number;
}

export interface FileSignatures {
  functions: FunctionSignature[];
  classes: ClassSignature[];
  exports: string[];
  imports: Array<{ from: string; names: string[] }>;
}

export interface DetectedPattern {
  pattern: string;
  confidence: number;
  indicators: string[];
}

export interface EnrichmentResult {
  signatures: FileSignatures;
  patterns: DetectedPattern[];
  suggestedLayer?: 'interface' | 'application' | 'domain' | 'infrastructure';
  suggestedType?: 'Component' | 'File';
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Signatures Extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract function and class signatures from a TypeScript/JavaScript file.
 */
export function getFileSignatures(filePath: string): FileSignatures {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return { functions: [], classes: [], exports: [], imports: [] };
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n');

  const functions: FunctionSignature[] = [];
  const classes: ClassSignature[] = [];
  const exports: string[] = [];
  const imports: Array<{ from: string; names: string[] }> = [];

  // Parse imports
  const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    const names = importMatch[1]
      ? importMatch[1].split(',').map(n => n.trim().split(' as ')[0].trim())
      : importMatch[2] ? [importMatch[2]] : importMatch[3] ? [importMatch[3]] : [];
    imports.push({ from: importMatch[4], names: names.filter(Boolean) });
  }

  // Parse functions
  const funcRegex = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?/gm;
  let funcMatch;
  while ((funcMatch = funcRegex.exec(content)) !== null) {
    const line = content.slice(0, funcMatch.index).split('\n').length;
    const params = parseParams(funcMatch[5]);

    functions.push({
      name: funcMatch[4],
      params,
      returnType: funcMatch[6]?.trim(),
      async: !!funcMatch[3],
      exported: !!funcMatch[2],
      line,
    });

    if (funcMatch[2]) {
      exports.push(funcMatch[4]);
    }
  }

  // Parse arrow functions with export
  const arrowRegex = /^(\s*)(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*(?::\s*([^\s=]+))?\s*=>/gm;
  let arrowMatch;
  while ((arrowMatch = arrowRegex.exec(content)) !== null) {
    const line = content.slice(0, arrowMatch.index).split('\n').length;
    const paramsStart = content.indexOf('(', arrowMatch.index) + 1;
    const paramsEnd = content.indexOf(')', paramsStart);
    const paramsStr = content.slice(paramsStart, paramsEnd);

    functions.push({
      name: arrowMatch[4],
      params: parseParams(paramsStr),
      returnType: arrowMatch[6]?.trim(),
      async: !!arrowMatch[5],
      exported: !!arrowMatch[2],
      line,
    });

    if (arrowMatch[2]) {
      exports.push(arrowMatch[4]);
    }
  }

  // Parse classes
  const classRegex = /^(\s*)(export\s+)?(abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/gm;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    const classLine = content.slice(0, classMatch.index).split('\n').length;
    const className = classMatch[4];

    // Find class body
    const classStart = content.indexOf('{', classMatch.index);
    const classEnd = findMatchingBrace(content, classStart);
    const classBody = content.slice(classStart + 1, classEnd);

    const methods: FunctionSignature[] = [];
    const properties: Array<{ name: string; type?: string; visibility?: string }> = [];

    // Parse methods
    const methodRegex = /(public|private|protected)?\s*(async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      if (['constructor', 'if', 'for', 'while', 'switch'].includes(methodMatch[3])) continue;

      const methodLine = classLine + classBody.slice(0, methodMatch.index).split('\n').length;
      methods.push({
        name: methodMatch[3],
        params: parseParams(methodMatch[4]),
        returnType: methodMatch[5]?.trim(),
        async: !!methodMatch[2],
        exported: false,
        line: methodLine,
      });
    }

    classes.push({
      name: className,
      extends: classMatch[5],
      implements: classMatch[6]?.split(',').map(s => s.trim()),
      exported: !!classMatch[2],
      methods,
      properties,
      line: classLine,
    });

    if (classMatch[2]) {
      exports.push(className);
    }
  }

  // Parse export statements
  const namedExportRegex = /export\s+{\s*([^}]+)\s*}/g;
  let namedExportMatch;
  while ((namedExportMatch = namedExportRegex.exec(content)) !== null) {
    const names = namedExportMatch[1].split(',').map(n => n.trim().split(' as ')[0]);
    exports.push(...names);
  }

  return {
    functions,
    classes,
    exports: [...new Set(exports)],
    imports,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect architectural patterns in a file.
 *
 * Pattern detection is based on:
 * 1. Filename patterns (most reliable)
 * 2. Directory path patterns (reliable)
 * 3. Import statements (reliable)
 * 4. Decorator/annotation usage at statement level
 */
export function detectFilePatterns(filePath: string): DetectedPattern[] {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const fileName = path.basename(filePath).toLowerCase();
  const dirPath = path.dirname(absolutePath).toLowerCase();
  const patterns: DetectedPattern[] = [];

  // Parse imports for framework detection
  const imports = parseImportsSimple(content);
  const importSources = imports.map(i => i.from.toLowerCase());
  const importNames = imports.flatMap(i => i.names.map(n => n.toLowerCase()));

  // Controller pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('controller')) indicators.push('filename contains "controller"');
    if (dirPath.includes('/controllers/') || dirPath.includes('/controller/')) indicators.push('in controllers directory');
    if (importSources.some(s => s.includes('@nestjs/common'))) {
      if (hasDecoratorAtStatementLevel(content, 'Controller')) {
        indicators.push('uses @Controller decorator (NestJS)');
      }
    }
    if (importNames.includes('router') || content.match(/express\.Router\(\)/)) {
      if (hasRouteDefinitions(content)) {
        indicators.push('defines Express routes');
      }
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'controller',
        confidence: indicators.length >= 2 ? 0.95 : 0.9,
        indicators,
      });
    }
  }

  // Service pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('service') && !fileName.includes('.test.') && !fileName.includes('.spec.')) {
      indicators.push('filename contains "service"');
    }
    if (dirPath.includes('/services/') || dirPath.includes('/service/')) indicators.push('in services directory');
    if (importSources.some(s => s.includes('@nestjs/common'))) {
      if (hasDecoratorAtStatementLevel(content, 'Injectable')) {
        indicators.push('uses @Injectable decorator (NestJS)');
      }
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'service',
        confidence: indicators.length >= 2 ? 0.95 : 0.85,
        indicators,
      });
    }
  }

  // Repository pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('repository') || fileName.includes('repo.')) indicators.push('filename contains "repository/repo"');
    if (dirPath.includes('/repositories/') || dirPath.includes('/repository/')) indicators.push('in repositories directory');
    if (importSources.some(s => s.includes('typeorm'))) {
      if (hasDecoratorAtStatementLevel(content, 'Repository') || hasDecoratorAtStatementLevel(content, 'EntityRepository')) {
        indicators.push('uses TypeORM repository');
      }
    }
    if (importSources.some(s => s.includes('@prisma/client'))) indicators.push('uses Prisma client');
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'repository',
        confidence: indicators.length >= 2 ? 0.95 : 0.85,
        indicators,
      });
    }
  }

  // Model/Entity pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('model') || fileName.includes('entity') || fileName.includes('.dto.')) {
      indicators.push('filename indicates model/entity/dto');
    }
    if (dirPath.includes('/models/') || dirPath.includes('/entities/') || dirPath.includes('/dto/')) {
      indicators.push('in models/entities directory');
    }
    if (importSources.some(s => s.includes('typeorm'))) {
      if (hasDecoratorAtStatementLevel(content, 'Entity') || hasDecoratorAtStatementLevel(content, 'Column')) {
        indicators.push('uses TypeORM entity decorators');
      }
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'entity',
        confidence: indicators.length >= 2 ? 0.95 : 0.85,
        indicators,
      });
    }
  }

  // Middleware pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('middleware')) indicators.push('filename contains "middleware"');
    if (dirPath.includes('/middleware/') || dirPath.includes('/middlewares/')) indicators.push('in middleware directory');
    if (hasMiddlewareSignature(content)) indicators.push('exports middleware signature');
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'middleware',
        confidence: indicators.length >= 2 ? 0.9 : 0.8,
        indicators,
      });
    }
  }

  // React Component pattern
  {
    const indicators: string[] = [];
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) indicators.push('JSX file extension');
    if (dirPath.includes('/components/')) indicators.push('in components directory');
    const hasReactImport = importSources.some(s => s === 'react' || s === "'react'" || s === '"react"');
    if (hasReactImport && hasJSXReturn(content)) indicators.push('React component with JSX return');
    if (fileName.match(/^[A-Z]/) && (fileName.endsWith('.tsx') || fileName.endsWith('.jsx'))) {
      indicators.push('PascalCase filename (component convention)');
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'react-component',
        confidence: indicators.length >= 2 ? 0.95 : 0.8,
        indicators,
      });
    }
  }

  // Hook pattern
  {
    const indicators: string[] = [];
    if (fileName.match(/^use[A-Z]/) || fileName.includes('.hook.')) indicators.push('hook naming convention');
    if (dirPath.includes('/hooks/')) indicators.push('in hooks directory');
    if (exportsHookFunction(content)) indicators.push('exports React hook function');
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'hook',
        confidence: indicators.length >= 2 ? 0.95 : 0.8,
        indicators,
      });
    }
  }

  // Test pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('_test.')) {
      indicators.push('test file naming pattern');
    }
    if (dirPath.includes('/__tests__/') || dirPath.includes('/test/') || dirPath.includes('/tests/')) {
      indicators.push('in test directory');
    }
    if (importSources.some(s => s.includes('vitest') || s.includes('jest') || s.includes('@testing-library'))) {
      indicators.push('imports test framework');
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'test',
        confidence: 0.98,
        indicators,
      });
    }
  }

  // Config pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('config') || fileName.includes('.conf') || fileName === 'settings.ts') {
      indicators.push('config file naming pattern');
    }
    if (dirPath.includes('/config/')) indicators.push('in config directory');
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'config',
        confidence: indicators.length >= 2 ? 0.95 : 0.85,
        indicators,
      });
    }
  }

  // Utility pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('util') || fileName.includes('helper') || fileName.includes('helpers')) {
      indicators.push('filename indicates utility/helper');
    }
    if (dirPath.includes('/utils/') || dirPath.includes('/util/') || dirPath.includes('/helpers/') || dirPath.includes('/lib/')) {
      indicators.push('in utils/lib directory');
    }
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'utility',
        confidence: indicators.length >= 2 ? 0.9 : 0.75,
        indicators,
      });
    }
  }

  // Types pattern
  {
    const indicators: string[] = [];
    if (fileName.includes('.types.') || fileName.includes('.d.ts') || fileName === 'types.ts' || fileName === 'interfaces.ts') {
      indicators.push('type definition file naming');
    }
    if (dirPath.includes('/types/') || dirPath.includes('/@types/')) indicators.push('in types directory');
    if (indicators.length > 0) {
      patterns.push({
        pattern: 'types',
        confidence: 0.95,
        indicators,
      });
    }
  }

  return patterns;
}

/**
 * Get enrichment data for a file (signatures + patterns + suggested metadata)
 */
export function enrichFile(filePath: string): EnrichmentResult {
  const signatures = getFileSignatures(filePath);
  const patterns = detectFilePatterns(filePath);

  // Suggest layer based on patterns
  let suggestedLayer: EnrichmentResult['suggestedLayer'];
  const patternNames = patterns.map(p => p.pattern);

  if (patternNames.includes('controller') || patternNames.includes('react-component') || patternNames.includes('hook')) {
    suggestedLayer = 'interface';
  } else if (patternNames.includes('service') || patternNames.includes('middleware')) {
    suggestedLayer = 'application';
  } else if (patternNames.includes('entity') || patternNames.includes('types')) {
    suggestedLayer = 'domain';
  } else if (patternNames.includes('repository') || patternNames.includes('config')) {
    suggestedLayer = 'infrastructure';
  }

  // Suggest type based on content
  let suggestedType: EnrichmentResult['suggestedType'] = 'File';
  if (signatures.classes.length > 0 || signatures.functions.filter(f => f.exported).length > 0) {
    suggestedType = 'Component';
  }

  return {
    signatures,
    patterns,
    suggestedLayer,
    suggestedType,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function parseParams(paramsStr: string): Array<{ name: string; type?: string }> {
  if (!paramsStr?.trim()) return [];

  const params: Array<{ name: string; type?: string }> = [];
  const parts = paramsStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      params.push({ name: trimmed.split(':')[0].trim() });
      continue;
    }

    const [nameWithOptional, type] = trimmed.split(':').map(s => s.trim());
    const name = nameWithOptional.replace('?', '');

    params.push({ name, type });
  }

  return params;
}

function parseImportsSimple(content: string): Array<{ from: string; names: string[] }> {
  const imports: Array<{ from: string; names: string[] }> = [];
  const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const names = match[1]
      ? match[1].split(',').map(n => n.trim().split(' as ')[0].trim())
      : match[2] ? [match[2]] : match[3] ? [match[3]] : [];
    imports.push({ from: match[4], names: names.filter(Boolean) });
  }

  return imports;
}

function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return content.length;
}

function hasDecoratorAtStatementLevel(content: string, decoratorName: string): boolean {
  const pattern = new RegExp(`^\\s*@${decoratorName}\\s*\\(`, 'm');
  return pattern.test(content);
}

function hasRouteDefinitions(content: string): boolean {
  return /^\s*(router|app)\.(get|post|put|delete|patch)\s*\(/m.test(content);
}

function hasMiddlewareSignature(content: string): boolean {
  return /export\s+(default\s+)?(?:function|const|async\s+function)\s*\w*\s*\([^)]*(?:req|request)[^)]*,\s*(?:res|response)[^)]*,\s*next/i.test(content);
}

function exportsHookFunction(content: string): boolean {
  return /export\s+(?:default\s+)?(?:function|const)\s+use[A-Z]\w*/.test(content);
}

function hasJSXReturn(content: string): boolean {
  return /return\s*\(\s*</.test(content) || /return\s+</.test(content);
}
