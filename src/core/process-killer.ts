import type { IProcessInfo, IPlatformImplementation } from '../types';
import { getPlatform } from '../utils/platform';
import { WindowsPlatform } from '../platforms/windows';
import { MacOSPlatform } from '../platforms/macos';
import { LinuxPlatform } from '../platforms/linux';
import { PlatformError } from '../errors';

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
        // Log error but continue with other processes
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
        const processes = await this.platform.findProcessesByPort(0);
        const processExists = processes.some((p) => p.pid === pid);

        if (!processExists) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        return true;
      }
    }

    return false;
  }
}
