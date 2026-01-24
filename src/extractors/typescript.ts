/**
 * TypeScript/JavaScript Extractor
 *
 * Extracts dependency graph from TypeScript/JavaScript projects using madge.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import madge from 'madge';
import { Graph, Node, Edge } from '../core/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default directories to ignore during extraction.
 * These are commonly build outputs, caches, and tool-specific directories.
 */
export const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'out',
  '.git',
  'coverage',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.netlify',
  '.parcel-cache',
  '.vite',
  '.svelte-kit',
  '.angular',
  'vendor',
  '.bundle',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractOptions {
  /** Base directory to extract from */
  baseDir: string;
  /** Additional directories to scan (for multi-directory support) */
  additionalDirs?: string[];
  /** File extensions to include (default: ts, tsx, js, jsx) */
  extensions?: string[];
  /** Directories to exclude (merged with defaults) */
  excludeDir?: string[];
  /** Additional patterns to ignore */
  ignorePatterns?: string[];
  /** TypeScript config file path */
  tsConfig?: string;
  /** Webpack config file path */
  webpackConfig?: string;
  /** Whether to include node_modules */
  includeNodeModules?: boolean;
  /** Whether to skip default ignore patterns */
  noDefaultIgnore?: boolean;
}

export interface ExtractionResult {
  graph: Graph;
  stats: {
    filesScanned: number;
    componentsFound: number;
    dependenciesFound: number;
    circularDeps: string[][];
  };
  warnings: string[];
}

export interface PreviewResult {
  directories: string[];
  files: string[];
  excludedDirsFound: string[];
  extensions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preview (Dry Run)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Preview what would be extracted without actually running madge.
 * This is a fast operation that just scans for files matching the criteria.
 */
export async function previewExtraction(options: ExtractOptions): Promise<PreviewResult> {
  const {
    baseDir,
    additionalDirs = [],
    extensions = ['ts', 'tsx', 'js', 'jsx'],
    excludeDir = [],
    noDefaultIgnore = false,
  } = options;

  // Build exclude list: defaults + user-specified
  const allExcludeDirs = noDefaultIgnore
    ? excludeDir
    : [...new Set([...DEFAULT_IGNORE_DIRS, ...excludeDir])];

  // Build all directories to scan
  const allDirs = [baseDir, ...additionalDirs];

  // Verify all directories exist
  for (const dir of allDirs) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Directory not found: ${dir}`);
    }
  }

  // Find files matching criteria
  const files: string[] = [];
  const excludedDirsFound: string[] = [];

  for (const dir of allDirs) {
    const resolvedDir = path.resolve(dir);
    const dirPrefix = allDirs.length > 1 ? path.relative(process.cwd(), resolvedDir) : '';

    // Check which excluded dirs exist
    for (const excludeD of allExcludeDirs) {
      const excludePath = path.join(resolvedDir, excludeD);
      if (fs.existsSync(excludePath) && !excludedDirsFound.includes(excludeD)) {
        excludedDirsFound.push(excludeD);
      }
    }

    // Recursively find files
    const foundFiles = findFilesRecursive(resolvedDir, extensions, allExcludeDirs);
    for (const file of foundFiles) {
      const relativePath = path.relative(resolvedDir, file);
      files.push(dirPrefix ? path.join(dirPrefix, relativePath) : relativePath);
    }
  }

  return {
    directories: allDirs.map((d) => path.resolve(d)),
    files: files.sort(),
    excludedDirsFound,
    extensions,
  };
}

/**
 * Recursively find files with given extensions, excluding specified directories
 */
function findFilesRecursive(dir: string, extensions: string[], excludeDirs: string[]): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(entry.name)) {
          continue;
        }
        // Recurse into subdirectory
        files.push(...findFilesRecursive(fullPath, extensions, excludeDirs));
      } else if (entry.isFile()) {
        // Check extension
        const ext = path.extname(entry.name).slice(1); // Remove leading dot
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Ignore permission errors, etc.
  }

  return files;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Extractor
// ═══════════════════════════════════════════════════════════════════════════════

export async function extractTypeScript(options: ExtractOptions): Promise<ExtractionResult> {
  const {
    baseDir,
    additionalDirs = [],
    extensions = ['ts', 'tsx', 'js', 'jsx'],
    excludeDir = [],
    ignorePatterns = [],
    tsConfig,
    webpackConfig,
    includeNodeModules = false,
    noDefaultIgnore = false,
  } = options;

  // Build exclude list: defaults + user-specified
  const allExcludeDirs = noDefaultIgnore
    ? excludeDir
    : [...new Set([...DEFAULT_IGNORE_DIRS, ...excludeDir])];

  // Build all directories to scan
  const allDirs = [baseDir, ...additionalDirs];

  // Verify all directories exist
  for (const dir of allDirs) {
    if (!fs.existsSync(dir)) {
      throw new Error(`Directory not found: ${dir}`);
    }
  }

  // Find tsconfig if not specified (check base dir first, then current working directory)
  let resolvedTsConfig = tsConfig;
  if (!resolvedTsConfig) {
    const baseTsConfig = path.join(baseDir, 'tsconfig.json');
    const cwdTsConfig = path.join(process.cwd(), 'tsconfig.json');
    if (fs.existsSync(baseTsConfig)) {
      resolvedTsConfig = baseTsConfig;
    } else if (fs.existsSync(cwdTsConfig)) {
      resolvedTsConfig = cwdTsConfig;
    }
  }

  // Build exclusion regex patterns
  const excludePatterns: RegExp[] = [
    // Directory exclusions
    ...allExcludeDirs.map((d) => new RegExp(`(^|/)${escapeRegExp(d)}(/|$)`)),
    // File pattern exclusions (convert glob to regex)
    ...ignorePatterns.map((p) => globToRegex(p)),
  ];

  // Merge dependency trees from all directories
  let mergedDepTree: Record<string, string[]> = {};
  let allCircularDeps: string[][] = [];
  const warnings: string[] = [];

  for (const dir of allDirs) {
    const resolvedDir = path.resolve(dir);

    // Run madge on each directory
    const result = await madge(resolvedDir, {
      fileExtensions: extensions,
      excludeRegExp: excludePatterns,
      tsConfig: resolvedTsConfig,
      webpackConfig,
      includeNpm: includeNodeModules,
    });

    // Get dependency tree
    const depTree = result.obj();
    const circularDeps = result.circular();

    // Prefix paths with directory name for multi-dir support
    if (allDirs.length > 1) {
      const dirPrefix = path.relative(process.cwd(), resolvedDir);
      for (const [file, deps] of Object.entries(depTree)) {
        const prefixedFile = path.join(dirPrefix, file);
        const prefixedDeps = deps.map((d) => path.join(dirPrefix, d));
        mergedDepTree[prefixedFile] = prefixedDeps;
      }
      // Also prefix circular deps
      allCircularDeps.push(...circularDeps.map((cycle) =>
        cycle.map((f) => path.join(dirPrefix, f))
      ));
    } else {
      mergedDepTree = { ...mergedDepTree, ...depTree };
      allCircularDeps.push(...circularDeps);
    }
  }

  // Convert to GID graph
  const graph = convertToGraph(mergedDepTree, allDirs.length > 1 ? process.cwd() : baseDir);

  // Calculate stats
  const stats = {
    filesScanned: Object.keys(mergedDepTree).length,
    componentsFound: Object.keys(graph.nodes).length,
    dependenciesFound: graph.edges.length,
    circularDeps: allCircularDeps,
  };

  // Generate warnings
  if (allCircularDeps.length > 0) {
    warnings.push(`Found ${allCircularDeps.length} circular dependency chain(s)`);
  }

  if (stats.filesScanned === 0) {
    warnings.push('No files found. Check your path and file extensions.');
  }

  // Warn about ignored directories that exist
  const ignoredDirsFound = allExcludeDirs.filter((d) =>
    allDirs.some((dir) => fs.existsSync(path.join(dir, d)))
  );
  if (ignoredDirsFound.length > 0) {
    warnings.push(`Excluded directories: ${ignoredDirsFound.join(', ')}`);
  }

  return { graph, stats, warnings };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a simple glob pattern to a regex
 */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '@@DOUBLESTAR@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@DOUBLESTAR@@/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(escaped);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Conversion
// ═══════════════════════════════════════════════════════════════════════════════

function convertToGraph(depTree: Record<string, string[]>, baseDir: string): Graph {
  const nodes: Record<string, Node> = {};
  const edges: Edge[] = [];

  // Create nodes for all files
  for (const filePath of Object.keys(depTree)) {
    const nodeId = pathToNodeId(filePath);

    nodes[nodeId] = {
      type: 'File',
      description: `File: ${filePath}`,
      path: path.join(baseDir, filePath),
    };
  }

  // Create dependency edges
  for (const [filePath, deps] of Object.entries(depTree)) {
    const fromId = pathToNodeId(filePath);

    for (const dep of deps) {
      const toId = pathToNodeId(dep);

      // Make sure target node exists
      if (!nodes[toId]) {
        nodes[toId] = {
          type: 'File',
          description: `File: ${dep}`,
          path: path.join(baseDir, dep),
        };
      }

      edges.push({
        from: fromId,
        to: toId,
        relation: 'depends_on',
      });
    }
  }

  return { nodes, edges };
}

/**
 * Convert file path to a valid node ID
 * e.g., "src/services/user.ts" -> "src/services/user"
 */
function pathToNodeId(filePath: string): string {
  // Remove extension
  const withoutExt = filePath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');

  // Replace path separators with dots or keep as is
  // Using the path directly is more readable
  return withoutExt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component Grouping (Optional Enhancement)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Group files into components based on directory structure
 * e.g., all files in src/services/user/ become "UserService"
 */
export function groupIntoComponents(
  graph: Graph,
  options: {
    /** Minimum files to form a component group */
    minGroupSize?: number;
    /** Directories that define component boundaries */
    componentDirs?: string[];
  } = {}
): Graph {
  const { minGroupSize = 2, componentDirs = ['services', 'components', 'modules', 'features'] } =
    options;

  const nodes: Record<string, Node> = {};
  const edges: Edge[] = [];

  // Group files by directory
  const groups = new Map<string, string[]>();

  for (const nodeId of Object.keys(graph.nodes)) {
    const parts = nodeId.split('/');

    // Find component boundary
    let groupKey = nodeId;
    for (let i = 0; i < parts.length - 1; i++) {
      if (componentDirs.includes(parts[i])) {
        // Use next level as component name
        groupKey = parts.slice(0, i + 2).join('/');
        break;
      }
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(nodeId);
  }

  // Create component nodes for groups
  const fileToComponent = new Map<string, string>();

  for (const [groupKey, files] of groups) {
    if (files.length >= minGroupSize) {
      // Create a component node
      const componentId = groupKeyToComponentId(groupKey);
      nodes[componentId] = {
        type: 'Component',
        description: `Component containing ${files.length} files`,
        layer: inferLayer(groupKey),
      };

      for (const file of files) {
        fileToComponent.set(file, componentId);
      }
    } else {
      // Keep as individual file nodes
      for (const file of files) {
        nodes[file] = graph.nodes[file];
        fileToComponent.set(file, file);
      }
    }
  }

  // Convert edges to component-level
  const edgeSet = new Set<string>();

  for (const edge of graph.edges) {
    const fromComp = fileToComponent.get(edge.from) ?? edge.from;
    const toComp = fileToComponent.get(edge.to) ?? edge.to;

    // Skip self-references within component
    if (fromComp === toComp) continue;

    const edgeKey = `${fromComp}|${toComp}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      edges.push({
        from: fromComp,
        to: toComp,
        relation: 'depends_on',
      });
    }
  }

  return { nodes, edges };
}

function groupKeyToComponentId(groupKey: string): string {
  const parts = groupKey.split('/');
  // Take last meaningful part and PascalCase it
  const name = parts[parts.length - 1];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function inferLayer(path: string): 'interface' | 'application' | 'domain' | 'infrastructure' {
  const pathLower = path.toLowerCase();

  if (
    pathLower.includes('component') ||
    pathLower.includes('page') ||
    pathLower.includes('view') ||
    pathLower.includes('ui')
  ) {
    return 'interface';
  }

  if (
    pathLower.includes('service') ||
    pathLower.includes('controller') ||
    pathLower.includes('handler')
  ) {
    return 'application';
  }

  if (
    pathLower.includes('model') ||
    pathLower.includes('entity') ||
    pathLower.includes('domain')
  ) {
    return 'domain';
  }

  if (
    pathLower.includes('repo') ||
    pathLower.includes('db') ||
    pathLower.includes('api') ||
    pathLower.includes('client')
  ) {
    return 'infrastructure';
  }

  return 'application'; // Default
}
