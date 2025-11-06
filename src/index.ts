import type { IPortTerminatorOptions, IProcessInfo, ITerminationResult } from './types';
import { ProcessFinder } from './core/process-finder';
import { ProcessKiller } from './core/process-killer';
import { validatePort, validatePorts, validateTimeout } from './utils/validators';
import { TimeoutError } from './errors';
import { Logger } from './utils/logger';

/**
 * Main class for terminating processes running on specified ports.
 *
 * Provides cross-platform functionality to find and terminate processes
 * on Windows, macOS, and Linux systems with zero runtime dependencies.
 *
 * @example
 * ```typescript
 * const terminator = new PortTerminator({ force: false });
 * await terminator.terminate(3000);
 * ```
 */
export class PortTerminator {
  private processFinder: ProcessFinder;
  private processKiller: ProcessKiller;
  private options: Required<IPortTerminatorOptions>;
  private logger: Logger;

  /**
   * Creates a new PortTerminator instance.
   *
   * @param options - Configuration options for process termination
   * @param options.method - Protocol to target: 'tcp', 'udp', or 'both' (default: 'both')
   * @param options.timeout - Overall operation timeout in milliseconds (default: 30000)
   * @param options.force - Whether to force kill without graceful timeout (default: false)
   * @param options.silent - Suppress all output except errors (default: false)
   * @param options.gracefulTimeout - Graceful shutdown timeout in milliseconds (default: 5000)
   */
  constructor(options: IPortTerminatorOptions = {}) {
    this.processFinder = new ProcessFinder();
    this.processKiller = new ProcessKiller();

    this.options = {
      method: options.method || 'both',
      timeout: options.timeout !== undefined ? options.timeout : 30000,
      force: options.force || false,
      silent: options.silent || false,
      gracefulTimeout: options.gracefulTimeout !== undefined ? options.gracefulTimeout : 5000,
    };

    this.logger = new Logger('info', this.options.silent);
  }

  /**
   * Terminates processes running on the specified port(s).
   *
   * @param port - Port number or array of port numbers to terminate
   * @returns Promise resolving to true if all processes were successfully terminated
   *
   * @example
   * ```typescript
   * // Single port
   * await terminator.terminate(3000);
   *
   * // Multiple ports
   * await terminator.terminate([3000, 3001, 8080]);
   * ```
   */
  async terminate(port: number | number[]): Promise<boolean> {
    const ports = Array.isArray(port) ? port : [port];
    const validatedPorts = validatePorts(ports);

    this.logger.info(
      `Terminating processes on port${ports.length > 1 ? 's' : ''}: ${validatedPorts.join(', ')}`
    );

    const results = await this.terminateMultiple(validatedPorts);

    return Array.from(results.values()).every((success) => success);
  }

  /**
   * Terminates processes on multiple ports and returns individual results.
   *
   * @param ports - Array of port numbers to terminate
   * @returns Promise resolving to Map of port numbers to success status
   *
   * @example
   * ```typescript
   * const results = await terminator.terminateMultiple([3000, 3001, 8080]);
   * for (const [port, success] of results) {
   *   console.log(`Port ${port}: ${success ? 'terminated' : 'failed'}`);
   * }
   * ```
   */
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

  /**
   * Gets information about processes running on a specific port.
   *
   * @param port - Port number to check
   * @returns Promise resolving to array of process information objects
   *
   * @example
   * ```typescript
   * const processes = await terminator.getProcesses(3000);
   * processes.forEach(proc => {
   *   console.log(`PID: ${proc.pid}, Name: ${proc.name}`);
   * });
   * ```
   */
  async getProcesses(port: number): Promise<IProcessInfo[]> {
    const validatedPort = validatePort(port);
    const protocol = this.options.method;

    this.logger.debug(`Getting processes on port ${validatedPort}`);

    return this.processFinder.findByPort(validatedPort, protocol);
  }

  /**
   * Checks if a port is available (no processes running on it).
   *
   * @param port - Port number to check
   * @returns Promise resolving to true if port is available, false otherwise
   *
   * @example
   * ```typescript
   * const available = await terminator.isPortAvailable(3000);
   * console.log(available ? 'Port is free' : 'Port is in use');
   * ```
   */
  async isPortAvailable(port: number): Promise<boolean> {
    const validatedPort = validatePort(port);
    const protocol = this.options.method;

    return this.processFinder.isPortAvailable(validatedPort, protocol);
  }

  /**
   * Waits for a port to become available, with optional timeout.
   *
   * @param port - Port number to wait for
   * @param timeout - Optional timeout in milliseconds (defaults to instance timeout)
   * @returns Promise resolving to true when port becomes available
   * @throws {TimeoutError} If port doesn't become available within timeout
   *
   * @example
   * ```typescript
   * // Wait up to 10 seconds for port 3000 to be free
   * await terminator.waitForPort(3000, 10000);
   * console.log('Port 3000 is now available');
   * ```
   */
  async waitForPort(port: number, timeout?: number): Promise<boolean> {
    const validatedPort = validatePort(port);
    const timeoutMs = timeout !== undefined ? validateTimeout(timeout) : this.options.timeout;
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

  /**
   * Terminates processes on multiple ports and returns detailed results.
   *
   * @param ports - Array of port numbers to terminate
   * @returns Promise resolving to array of termination result objects
   *
   * @example
   * ```typescript
   * const results = await terminator.terminateWithDetails([3000, 3001]);
   * results.forEach(result => {
   *   console.log(`Port ${result.port}: ${result.success ? 'OK' : 'Failed'}`);
   *   console.log(`  Terminated ${result.processes.length} process(es)`);
   *   if (result.error) console.log(`  Error: ${result.error}`);
   * });
   * ```
   */
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

/**
 * Convenience function to kill a process on a specific port.
 *
 * @param port - Port number to terminate
 * @param options - Optional configuration options
 * @returns Promise resolving to true if process was successfully terminated
 *
 * @example
 * ```typescript
 * await killPort(3000, { force: true });
 * ```
 */
export async function killPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<boolean> {
  const terminator = new PortTerminator(options);
  return terminator.terminate(port);
}

/**
 * Convenience function to kill processes on multiple ports.
 *
 * @param ports - Array of port numbers to terminate
 * @param options - Optional configuration options
 * @returns Promise resolving to Map of port numbers to success status
 *
 * @example
 * ```typescript
 * const results = await killPorts([3000, 3001, 8080]);
 * ```
 */
export async function killPorts(
  ports: number[],
  options: IPortTerminatorOptions = {}
): Promise<Map<number, boolean>> {
  const terminator = new PortTerminator(options);
  return terminator.terminateMultiple(ports);
}

/**
 * Convenience function to get the first process running on a port.
 *
 * @param port - Port number to check
 * @param options - Optional configuration options
 * @returns Promise resolving to process info or null if no process found
 *
 * @example
 * ```typescript
 * const process = await getProcessOnPort(3000);
 * if (process) console.log(`PID: ${process.pid}`);
 * ```
 */
export async function getProcessOnPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<IProcessInfo | null> {
  const terminator = new PortTerminator(options);
  const processes = await terminator.getProcesses(port);
  return processes.length > 0 ? processes[0] : null;
}

/**
 * Convenience function to get all processes running on a port.
 *
 * @param port - Port number to check
 * @param options - Optional configuration options
 * @returns Promise resolving to array of process information objects
 *
 * @example
 * ```typescript
 * const processes = await getProcessesOnPort(3000);
 * processes.forEach(proc => console.log(proc.name));
 * ```
 */
export async function getProcessesOnPort(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<IProcessInfo[]> {
  const terminator = new PortTerminator(options);
  return terminator.getProcesses(port);
}

/**
 * Convenience function to check if a port is available.
 *
 * @param port - Port number to check
 * @param options - Optional configuration options
 * @returns Promise resolving to true if port is available, false otherwise
 *
 * @example
 * ```typescript
 * const available = await isPortAvailable(3000);
 * ```
 */
export async function isPortAvailable(
  port: number,
  options: IPortTerminatorOptions = {}
): Promise<boolean> {
  const terminator = new PortTerminator(options);
  return terminator.isPortAvailable(port);
}

/**
 * Convenience function to wait for a port to become available.
 *
 * @param port - Port number to wait for
 * @param timeout - Optional timeout in milliseconds
 * @param options - Optional configuration options
 * @returns Promise resolving to true when port becomes available
 * @throws {TimeoutError} If port doesn't become available within timeout
 *
 * @example
 * ```typescript
 * await waitForPort(3000, 5000);
 * console.log('Port 3000 is now free');
 * ```
 */
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
