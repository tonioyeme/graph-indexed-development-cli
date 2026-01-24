#!/usr/bin/env node

/**
 * GID CLI - Graph-Indexed Development
 *
 * Query and manage dependency graphs for software projects.
 */

import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runImpactQuery, runDepsQuery, runCommonCauseQuery, runPathQuery } from './commands/query.js';
import { runCheck, runListRules } from './commands/check.js';
import { runExtract, listDefaultIgnores } from './commands/extract.js';
import { runDesign } from './commands/design.js';
import { runHistoryList, runHistoryDiff, runHistoryRestore } from './commands/history.js';
import { runVisual } from './commands/visual.js';

const program = new Command();

program
  .name('gid')
  .description('Graph-Indexed Development CLI - Query and manage dependency graphs')
  .version('0.1.0');

// ═══════════════════════════════════════════════════════════════════════════════
// init command
// ═══════════════════════════════════════════════════════════════════════════════

program
  .command('init')
  .description('Initialize a new graph.yml in the current project')
  .option('-f, --force', 'Overwrite existing graph.yml')
  .action((options) => {
    runInit({ force: options.force });
  });

// ═══════════════════════════════════════════════════════════════════════════════
// query command
// ═══════════════════════════════════════════════════════════════════════════════

const queryCommand = program
  .command('query')
  .description('Query the dependency graph');

// query impact
queryCommand
  .command('impact <node>')
  .description('Analyze what is affected by changing a node')
  .action((node) => {
    runImpactQuery(node);
  });

// query deps
queryCommand
  .command('deps <node>')
  .description('Show dependencies of a node (what it depends on)')
  .option('-r, --reverse', 'Show dependents instead (what depends on it)')
  .action((node, options) => {
    runDepsQuery(node, { reverse: options.reverse });
  });

// query common-cause
queryCommand
  .command('common-cause <nodeA> <nodeB>')
  .description('Find common dependencies of two nodes (useful for debugging)')
  .action((nodeA, nodeB) => {
    runCommonCauseQuery(nodeA, nodeB);
  });

// query path
queryCommand
  .command('path <from> <to>')
  .description('Find dependency path between two nodes')
  .action((from, to) => {
    runPathQuery(from, to);
  });

// ═══════════════════════════════════════════════════════════════════════════════
// check command
// ═══════════════════════════════════════════════════════════════════════════════

const checkCommand = program
  .command('check')
  .description('Validate graph against integrity rules')
  .option('--rules <rules...>', 'Only run specific rules')
  .option('--disable <rules...>', 'Disable specific rules')
  .option('--threshold <n>', 'High coupling threshold (default: 5)', parseInt)
  .option('--json', 'Output as JSON')
  .action((options) => {
    runCheck({
      rules: options.rules,
      disable: options.disable,
      threshold: options.threshold,
      json: options.json,
    });
  });

// check rules (list available rules)
checkCommand
  .command('rules')
  .description('List available validation rules')
  .action(() => {
    runListRules();
  });

// ═══════════════════════════════════════════════════════════════════════════════
// extract command
// ═══════════════════════════════════════════════════════════════════════════════

const extractCommand = program
  .command('extract [directories...]')
  .description('Extract dependency graph from existing code')
  .option('-l, --lang <language>', 'Source language (typescript, javascript)', 'typescript')
  .option('-o, --output <file>', 'Output file path')
  .option('-g, --group', 'Group files into components by directory')
  .option('-f, --force', 'Overwrite existing graph')
  .option('--tsconfig <file>', 'Path to tsconfig.json')
  .option('-i, --ignore <patterns...>', 'Additional patterns/directories to ignore')
  .option('--no-default-ignore', 'Disable default ignore patterns (.next, dist, etc.)')
  .option('-n, --dry-run', 'Preview what would be extracted without making changes')
  .option('--incremental', 'Only process changed files (faster for large projects)')
  .option('--interactive', 'Interactive guided extraction')
  .action((directories, options) => {
    runExtract(directories || ['.'], {
      lang: options.lang,
      output: options.output,
      group: options.group,
      force: options.force,
      tsconfig: options.tsconfig,
      ignore: options.ignore,
      noDefaultIgnore: !options.defaultIgnore,
      dryRun: options.dryRun,
      incremental: options.incremental,
      interactive: options.interactive,
    });
  });

// extract ignore-list subcommand
extractCommand
  .command('ignore-list')
  .description('List default ignored directories')
  .action(() => {
    listDefaultIgnores();
  });

// ═══════════════════════════════════════════════════════════════════════════════
// design command
// ═══════════════════════════════════════════════════════════════════════════════

program
  .command('design')
  .description('AI-assisted top-down graph design')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic, ollama)')
  .option('-m, --model <model>', 'AI model to use')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --force', 'Overwrite existing graph')
  .option('--non-interactive', 'Run without interactive prompts')
  .option('-r, --requirements <text>', 'Requirements text (for non-interactive mode)')
  .action((options) => {
    runDesign({
      provider: options.provider,
      model: options.model,
      output: options.output,
      force: options.force,
      nonInteractive: options.nonInteractive,
      requirements: options.requirements,
    });
  });

// ═══════════════════════════════════════════════════════════════════════════════
// visual command
// ═══════════════════════════════════════════════════════════════════════════════

program
  .command('visual')
  .description('Interactive graph visualization')
  .option('-p, --port <port>', 'Server port (default: 3000)', parseInt)
  .option('--no-open', 'Do not open browser automatically')
  .action((options) => {
    runVisual({
      port: options.port,
      noOpen: !options.open,
    });
  });

// ═══════════════════════════════════════════════════════════════════════════════
// history command
// ═══════════════════════════════════════════════════════════════════════════════

const historyCommand = program
  .command('history')
  .description('Manage graph version history');

// history list
historyCommand
  .command('list')
  .description('List available graph versions')
  .action(() => {
    runHistoryList();
  });

// history diff
historyCommand
  .command('diff <version>')
  .description('Compare a historical version to current graph')
  .action((version) => {
    runHistoryDiff(version);
  });

// history restore
historyCommand
  .command('restore <version>')
  .description('Restore a historical version')
  .option('-f, --force', 'Overwrite current graph without confirmation')
  .action((version, options) => {
    runHistoryRestore(version, { force: options.force });
  });

// ═══════════════════════════════════════════════════════════════════════════════
// Parse and execute
// ═══════════════════════════════════════════════════════════════════════════════

program.parse();
