#!/usr/bin/env node

import { PortTerminator, getProcessesOnPort } from '../index';
import { CommandParser } from '../utils/command-parser';
import { Logger } from '../utils/logger';
import type { ICliOptions, IProcessInfo } from '../types';
import { parsePortRange } from '../utils/validators';
import { PortTerminatorError } from '../errors';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json');

interface ICliResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

class CLI {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('info', false);
  }

  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    try {
      const options = CommandParser.parseArgs(args);

      if (options.help) {
        this.showHelp();
        return;
      }

      if (options.version) {
        this.showVersion();
        return;
      }

      if (options.silent) {
        this.logger.setSilent(true);
      }

      const result = await this.executeCommand(options);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.message) {
        if (result.success) {
          this.logger.info(result.message);
        } else {
          this.logger.error(result.message);
        }
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(message);
      process.exit(1);
    }
  }

  private async executeCommand(options: ICliOptions): Promise<ICliResult> {
    const ports = this.resolvePorts(options);

    if (ports.length === 0) {
      return {
        success: false,
        message: 'No ports specified. Use --help for usage information.',
      };
    }

    if (options.dryRun) {
      return this.executeDryRun(ports, options);
    }

    return this.executeTermination(ports, options);
  }

  private resolvePorts(options: ICliOptions): number[] {
    const ports: number[] = [];

    if (options.ports) {
      ports.push(...options.ports);
    }

    if (options.range) {
      const rangePorts = parsePortRange(options.range);
      ports.push(...rangePorts);
    }

    return [...new Set(ports)].sort((a, b) => a - b);
  }

  private async executeDryRun(ports: number[], options: ICliOptions): Promise<ICliResult> {
    const results: Array<{
      port: number;
      processes: IProcessInfo[];
    }> = [];

    for (const port of ports) {
      try {
        const processes = await getProcessesOnPort(port, {
          method: options.method,
          silent: true,
        });

        results.push({ port, processes });
      } catch (error) {
        results.push({ port, processes: [] });
      }
    }

    const totalProcesses = results.reduce((sum, result) => sum + result.processes.length, 0);

    if (options.json) {
      return {
        success: true,
        data: {
          dryRun: true,
          ports: results,
          totalProcesses,
        },
      };
    }

    let message = `Dry run: Would terminate ${totalProcesses} process(es) on ${ports.length} port(s)\n`;

    for (const result of results) {
      if (result.processes.length > 0) {
        message += `\nPort ${result.port}:\n`;
        for (const process of result.processes) {
          message += `  - PID ${process.pid}: ${process.name} (${process.protocol})\n`;
          if (process.command) {
            message += `    Command: ${process.command}\n`;
          }
        }
      }
    }

    return {
      success: true,
      message: message.trim(),
    };
  }

  private async executeTermination(ports: number[], options: ICliOptions): Promise<ICliResult> {
    const terminator = new PortTerminator({
      method: options.method,
      timeout: options.timeout,
      force: options.force,
      silent: options.silent,
      gracefulTimeout: options.gracefulTimeout,
    });

    try {
      const results = await terminator.terminateWithDetails(ports);
      const successCount = results.filter((r) => r.success).length;
      const totalProcesses = results.reduce((sum, result) => sum + result.processes.length, 0);

      if (options.json) {
        return {
          success: successCount === results.length,
          data: {
            results,
            summary: {
              totalPorts: ports.length,
              successfulPorts: successCount,
              totalProcessesKilled: totalProcesses,
            },
          },
        };
      }

      let message = `Successfully terminated ${totalProcesses} process(es) on ${successCount}/${results.length} port(s)`;

      const failedResults = results.filter((r) => !r.success);
      if (failedResults.length > 0) {
        message += `\n\nFailed ports:`;
        for (const result of failedResults) {
          message += `\n  - Port ${result.port}: ${result.error || 'Unknown error'}`;
        }
      }

      if (!options.silent && totalProcesses > 0) {
        message += `\n\nTerminated processes:`;
        for (const result of results.filter((r) => r.processes.length > 0)) {
          message += `\n\nPort ${result.port}:`;
          for (const process of result.processes) {
            message += `\n  - PID ${process.pid}: ${process.name} (${process.protocol})`;
          }
        }
      }

      return {
        success: successCount === results.length,
        message: message.trim(),
      };
    } catch (error) {
      const message =
        error instanceof PortTerminatorError
          ? `${error.name}: ${error.message}`
          : `Error: ${error instanceof Error ? error.message : String(error)}`;

      return {
        success: false,
        message,
      };
    }
  }

  private showHelp(): void {
    const help = `
@oxog/port-terminator v${packageJson.version}

Cross-platform utility to terminate processes running on specified ports

USAGE:
  port-terminator <port> [options]
  port-terminator <port1> <port2> ... [options]
  pt <port> [options]

OPTIONS:
  -r, --range <start-end>     Kill processes in port range (e.g., 3000-3005)
  -f, --force                 Force kill without graceful timeout
  -t, --timeout <ms>          Overall operation timeout (default: 30000)
  -g, --graceful-timeout <ms> Graceful shutdown timeout (default: 5000)
  -m, --method <protocol>     Protocol to target: tcp, udp, or both (default: both)
  -n, --dry-run               Show what would be killed without actually killing
  -j, --json                  Output results in JSON format
  -s, --silent                Suppress all output except errors
  -h, --help                  Show this help message
  -v, --version               Show version number

EXAMPLES:
  port-terminator 3000                    # Kill process on port 3000
  port-terminator 3000 3001 3002         # Kill processes on multiple ports
  port-terminator --range 3000-3005      # Kill processes on port range
  port-terminator 3000 --force           # Force kill without grace period
  port-terminator 3000 --dry-run         # Preview what would be killed
  port-terminator 3000 --method tcp      # Only kill TCP processes
  port-terminator 3000 --json            # Output in JSON format
  pt 3000                                 # Short alias

EXIT CODES:
  0    Success
  1    Error or failure

For more information, visit: https://github.com/ersinkoc/port-terminator
`.trim();

    console.log(help);
  }

  private showVersion(): void {
    console.log(`@oxog/port-terminator v${packageJson.version}`);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  const logger = new Logger();
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new Logger();
  logger.error('Uncaught exception:', error.message);
  process.exit(1);
});

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new CLI();
  cli.run().catch((error) => {
    const logger = new Logger();
    logger.error('CLI error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });
}

export { CLI };
