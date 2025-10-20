import type { IProcessInfo, IPlatformImplementation } from '../types';
import { getPlatform } from '../utils/platform';
import { WindowsPlatform } from '../platforms/windows';
import { MacOSPlatform } from '../platforms/macos';
import { LinuxPlatform } from '../platforms/linux';
import { PlatformError } from '../errors';
import { validatePID } from '../utils/validators';

export class ProcessKiller {
  private platform: IPlatformImplementation;

  constructor() {
    const platformName = getPlatform();

    switch (platformName) {
      case 'win32':
        this.platform = new WindowsPlatform();
        break;
      case 'darwin':
        this.platform = new MacOSPlatform();
        break;
      case 'linux':
        this.platform = new LinuxPlatform();
        break;
      default:
        throw new PlatformError(platformName);
    }
  }

  async killProcess(pid: number, force = false, gracefulTimeout = 5000): Promise<boolean> {
    // Validate PID before attempting to kill
    validatePID(pid);

    if (!force && gracefulTimeout > 0) {
      try {
        await this.platform.killProcess(pid, false);

        const isKilled = await this.waitForProcessToExit(pid, gracefulTimeout);
        if (isKilled) {
          return true;
        }
      } catch (error) {
        // Continue to force kill
      }
    }

    return this.platform.killProcess(pid, true);
  }

  async killProcesses(
    pids: number[],
    force = false,
    gracefulTimeout = 5000
  ): Promise<Map<number, boolean>> {
    const results = new Map<number, boolean>();

    await Promise.all(
      pids.map(async (pid) => {
        try {
          const success = await this.killProcess(pid, force, gracefulTimeout);
          results.set(pid, success);
        } catch (error) {
          // Log error for debugging but don't throw - continue with other processes
          if (error instanceof Error) {
            console.debug(`Failed to kill process ${pid}: ${error.message}`);
          }
          results.set(pid, false);
        }
      })
    );

    return results;
  }

  async killProcessesByPort(
    port: number,
    force = false,
    gracefulTimeout = 5000,
    protocol?: string
  ): Promise<IProcessInfo[]> {
    const processes = await this.platform.findProcessesByPort(port, protocol);

    if (processes.length === 0) {
      return [];
    }

    const killedProcesses: IProcessInfo[] = [];

    for (const process of processes) {
      try {
        const success = await this.killProcess(process.pid, force, gracefulTimeout);
        if (success) {
          killedProcesses.push(process);
        }
      } catch (error) {
        // Log error for debugging but continue with other processes
        if (error instanceof Error) {
          console.debug(
            `Failed to kill process ${process.pid} (${process.name}) on port ${port}: ${error.message}`
          );
        }
      }
    }

    return killedProcesses;
  }

  async killProcessesByPorts(
    ports: number[],
    force = false,
    gracefulTimeout = 5000,
    protocol?: string
  ): Promise<Map<number, IProcessInfo[]>> {
    const results = new Map<number, IProcessInfo[]>();

    await Promise.all(
      ports.map(async (port) => {
        try {
          const killedProcesses = await this.killProcessesByPort(
            port,
            force,
            gracefulTimeout,
            protocol
          );
          results.set(port, killedProcesses);
        } catch (error) {
          // Log error for debugging but don't throw - continue with other ports
          if (error instanceof Error) {
            console.debug(`Failed to kill processes on port ${port}: ${error.message}`);
          }
          results.set(port, []);
        }
      })
    );

    return results;
  }

  private async waitForProcessToExit(pid: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < timeout) {
      try {
        // Use platform-specific process existence check
        const isRunning = await this.platform.isProcessRunning(pid);

        if (!isRunning) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        // If we get an error checking the process, assume it exited
        return true;
      }
    }

    return false;
  }
}
