import type { IPortTerminatorOptions, IProcessInfo, ITerminationResult } from './types';
import { ProcessFinder } from './core/process-finder';
import { ProcessKiller } from './core/process-killer';
import { validatePort, validatePorts, validateTimeout } from './utils/validators';
import { TimeoutError } from './errors';
import { Logger } from './utils/logger';

export class PortTerminator {
  private processFinder: ProcessFinder;
  private processKiller: ProcessKiller;
  private options: Required<IPortTerminatorOptions>;
  private logger: Logger;

  constructor(options: IPortTerminatorOptions = {}) {
    this.processFinder = new ProcessFinder();
    this.processKiller = new ProcessKiller();

    this.options = {
      method: options.method || 'both',
      timeout: options.timeout || 30000,
      force: options.force || false,
      silent: options.silent || false,
      gracefulTimeout: options.gracefulTimeout || 5000,
    };

    this.logger = new Logger('info', this.options.silent);
  }

  async terminate(port: number | number[]): Promise<boolean> {
    const ports = Array.isArray(port) ? port : [port];
    const validatedPorts = validatePorts(ports);

    this.logger.info(
      `Terminating processes on port${ports.length > 1 ? 's' : ''}: ${validatedPorts.join(', ')}`
    );

    const results = await this.terminateMultiple(validatedPorts);

    return Array.from(results.values()).every((success) => success);
  }

  async terminateMultiple(ports: number[]): Promise<Map<number, boolean>> {
    const validatedPorts = validatePorts(ports);
    const results = new Map<number, boolean>();

    const protocol = this.options.method;

    await Promise.all(
      validatedPorts.map(async (port) => {
        try {
          this.logger.debug(`Finding processes on port ${port}`);
          const processes = await this.processFinder.findByPort(port, protocol);

          if (processes.length === 0) {
            this.logger.warn(`No processes found on port ${port}`);
            results.set(port, true);
            return;
          }

          this.logger.info(`Found ${processes.length} process(es) on port ${port}`);

          const killedProcesses = await this.processKiller.killProcessesByPort(
            port,
            this.options.force,
            this.options.gracefulTimeout,
            protocol
          );

          const success = killedProcesses.length === processes.length;
          results.set(port, success);

          if (success) {
            this.logger.info(
              `Successfully terminated ${killedProcesses.length} process(es) on port ${port}`
            );
          } else {
            this.logger.error(`Failed to terminate some processes on port ${port}`);
          }
        } catch (error) {
          this.logger.error(
            `Error terminating processes on port ${port}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          results.set(port, false);
        }
      })
    );

    return results;
  }

  async getProcesses(port: number): Promise<IProcessInfo[]> {
    const validatedPort = validatePort(port);
    const protocol = this.options.method;

    this.logger.debug(`Getting processes on port ${validatedPort}`);

    return this.processFinder.findByPort(validatedPort, protocol);
  }

  async isPortAvailable(port: number): Promise<boolean> {
    const validatedPort = validatePort(port);
    const protocol = this.options.method;

    return this.processFinder.isPortAvailable(validatedPort, protocol);
  }

  async waitForPort(port: number, timeout?: number): Promise<boolean> {
    const validatedPort = validatePort(port);
    const timeoutMs = timeout ? validateTimeout(timeout) : this.options.timeout;
    const protocol = this.options.method;

    this.logger.debug(
      `Waiting for port ${validatedPort} to become available (timeout: ${timeoutMs}ms)`
    );

    const success = await this.processFinder.waitForPortToBeAvailable(
      validatedPort,
      timeoutMs,
      protocol
    );

    if (!success) {
      throw new TimeoutError(`waitForPort(${validatedPort})`, timeoutMs);
    }

    return success;
  }

  async terminateWithDetails(ports: number[]): Promise<ITerminationResult[]> {
    const validatedPorts = validatePorts(ports);
    const results: ITerminationResult[] = [];
    const protocol = this.options.method;

    for (const port of validatedPorts) {
      try {
        const processes = await this.processFinder.findByPort(port, protocol);

        if (processes.length === 0) {
          results.push({
            port,
            success: true,
            processes: [],
          });
          continue;
        }

        const killedProcesses = await this.processKiller.killProcessesByPort(
          port,
          this.options.force,
          this.options.gracefulTimeout,
          protocol
        );

        results.push({
          port,
          success: killedProcesses.length === processes.length,
          processes: killedProcesses,
        });
      } catch (error) {
        results.push({
          port,
          success: false,
          processes: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

// Convenience functions
export async function killPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<boolean> {
  const terminator = new PortTerminator(options);
  return terminator.terminate(port);
}

export async function killPorts(
  ports: number[],
  options: IPortTerminatorOptions = {}
): Promise<Map<number, boolean>> {
  const terminator = new PortTerminator(options);
  return terminator.terminateMultiple(ports);
}

export async function getProcessOnPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<IProcessInfo | null> {
  const terminator = new PortTerminator(options);
  const processes = await terminator.getProcesses(port);
  return processes.length > 0 ? processes[0] : null;
}

export async function getProcessesOnPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<IProcessInfo[]> {
  const terminator = new PortTerminator(options);
  return terminator.getProcesses(port);
}

export async function isPortAvailable(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<boolean> {
  const terminator = new PortTerminator(options);
  return terminator.isPortAvailable(port);
}

export async function waitForPort(
  port: number,
  timeout?: number,
  options: IPortTerminatorOptions = {}
): Promise<boolean> {
  const terminator = new PortTerminator(options);
  return terminator.waitForPort(port, timeout);
}

// Re-export types and errors
export * from './types';
export * from './errors';
export { ProcessFinder } from './core/process-finder';
export { ProcessKiller } from './core/process-killer';
export { PortScanner } from './core/port-scanner';
export { Logger } from './utils/logger';
export { validatePort, validatePorts, parsePortRange } from './utils/validators';
export { getPlatform, isWindows, isMacOS, isLinux } from './utils/platform';
