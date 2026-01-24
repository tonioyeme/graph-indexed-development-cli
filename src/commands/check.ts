/**
 * gid check command
 *
 * Validate graph against integrity rules.
 */

import chalk from 'chalk';
import { loadGraph, GIDGraph, Validator, ValidationSummary, ValidationIssue, GIDError } from '../core/index.js';

export interface CheckOptions {
  rules?: string[]; // Only run specific rules
  disable?: string[]; // Disable specific rules
  threshold?: number; // High coupling threshold
  json?: boolean; // Output as JSON
}

export function runCheck(options: CheckOptions = {}): void {
  try {
    const graphData = loadGraph();
    const graph = new GIDGraph(graphData);

    const validator = new Validator({
      enabledRules: options.rules,
      disabledRules: options.disable,
      highCouplingThreshold: options.threshold,
    });

    const result = validator.validate(graph);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printValidationResult(result);
    }

    // Exit with error code if validation failed
    if (!result.passed) {
      process.exit(1);
    }
  } catch (err) {
    handleError(err);
  }
}

export function runListRules(): void {
  const rules = Validator.getRules();

  console.log();
  console.log(chalk.bold('Available validation rules:'));
  console.log(chalk.dim('─'.repeat(60)));
  console.log();

  for (const rule of rules) {
    const severityColor =
      rule.severity === 'error'
        ? chalk.red
        : rule.severity === 'warning'
          ? chalk.yellow
          : chalk.blue;

    console.log(`  ${chalk.cyan(rule.name)}`);
    console.log(`    ${rule.description}`);
    console.log(`    Severity: ${severityColor(rule.severity)}`);
    console.log();
  }
}

function printValidationResult(result: ValidationSummary): void {
  console.log();
  console.log(chalk.bold('Graph Validation Report'));
  console.log(chalk.dim('═'.repeat(60)));
  console.log();

  // Group issues by rule
  const issuesByRule = new Map<string, ValidationIssue[]>();
  for (const issue of result.issues) {
    if (!issuesByRule.has(issue.rule)) {
      issuesByRule.set(issue.rule, []);
    }
    issuesByRule.get(issue.rule)!.push(issue);
  }

  // Print each rule's status
  const allRules = Validator.getRules();
  for (const rule of allRules) {
    const issues = issuesByRule.get(rule.name) ?? [];
    const passed = issues.length === 0;

    const statusIcon = passed
      ? chalk.green('✓')
      : rule.severity === 'error'
        ? chalk.red('✗')
        : rule.severity === 'warning'
          ? chalk.yellow('⚠')
          : chalk.blue('ℹ');

    const statusText = passed ? chalk.green('PASSED') : chalk.dim(`${issues.length} issue(s)`);

    console.log(`${statusIcon} ${rule.name.padEnd(35)} ${statusText}`);

    // Print issue details
    if (!passed) {
      for (const issue of issues) {
        console.log(chalk.dim(`    └─ ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.dim(`       ${chalk.italic(issue.suggestion)}`));
        }
      }
    }
  }

  console.log();
  console.log(chalk.dim('─'.repeat(60)));

  // Print summary
  const { stats, healthScore } = result;

  console.log();
  console.log(chalk.bold('Summary:'));

  if (stats.errors > 0) {
    console.log(`  ${chalk.red('✗')} Errors:   ${stats.errors}`);
  }
  if (stats.warnings > 0) {
    console.log(`  ${chalk.yellow('⚠')} Warnings: ${stats.warnings}`);
  }
  if (stats.info > 0) {
    console.log(`  ${chalk.blue('ℹ')} Info:     ${stats.info}`);
  }

  // Health score
  const scoreColor =
    healthScore >= 80 ? chalk.green : healthScore >= 50 ? chalk.yellow : chalk.red;

  console.log();
  console.log(`Health Score: ${scoreColor(healthScore + '/100')}`);

  // Final status
  console.log();
  if (result.passed) {
    console.log(chalk.green('✓ All critical checks passed'));
  } else {
    console.log(chalk.red('✗ Validation failed - please fix errors above'));
  }
}

function handleError(err: unknown): void {
  if (err instanceof GIDError) {
    console.error();
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }

  console.error(chalk.red('Unexpected error:'), err);
  process.exit(1);
}
