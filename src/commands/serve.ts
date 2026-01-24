/**
 * gid serve command
 *
 * Start web server for graph visualization.
 */

import chalk from 'chalk';
import { startServer } from '../web/server.js';
import { GIDError } from '../core/types.js';

export interface ServeOptions {
  port?: number;
  graph?: string;
  open?: boolean;
}

export function runServe(options: ServeOptions = {}): void {
  try {
    const port = options.port || 3000;

    console.log();
    console.log(chalk.bold('Starting GID Visualization Server...'));

    startServer({
      port,
      graphPath: options.graph,
      open: options.open !== false,
    });

    console.log(chalk.dim('Press Ctrl+C to stop'));
  } catch (err) {
    handleError(err);
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
