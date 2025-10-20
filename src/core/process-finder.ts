import type { IProcessInfo, IPlatformImplementation } from '../types';
import { getPlatform } from '../utils/platform';
import { WindowsPlatform } from '../platforms/windows';
import { MacOSPlatform } from '../platforms/macos';
import { LinuxPlatform } from '../platforms/linux';
import { PlatformError } from '../errors';

export class ProcessFinder {
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

  async findByPort(port: number, protocol?: string): Promise<IProcessInfo[]> {
    return this.platform.findProcessesByPort(port, protocol);
  }

  async findByPorts(ports: number[], protocol?: string): Promise<Map<number, IProcessInfo[]>> {
    const results = new Map<number, IProcessInfo[]>();

    await Promise.all(
      ports.map(async (port) => {
        try {
          const processes = await this.findByPort(port, protocol);
          results.set(port, processes);
        } catch (error) {
          // Log error for debugging but don't throw - continue with other ports
          if (error instanceof Error) {
            console.debug(`Failed to find processes on port ${port}: ${error.message}`);
          }
          results.set(port, []);
        }
      })
    );

    return results;
  }

  async isPortAvailable(port: number, protocol?: string): Promise<boolean> {
    return this.platform.isPortAvailable(port, protocol);
  }

  async waitForPortToBeAvailable(
    port: number,
    timeout = 30000,
    protocol?: string
  ): Promise<boolean> {
    const checkInterval = 250;
    const startTime = Date.now();

    // Perform an initial check immediately
    let isAvailable = await this.isPortAvailable(port, protocol);
    if (isAvailable) {
      return true;
    }

    // If timeout is 0 and not immediately available, return false
    if (timeout === 0) {
      return false;
    }

    // Use time-based loop instead of iteration count
    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      isAvailable = await this.isPortAvailable(port, protocol);
      if (isAvailable) {
        return true;
      }
    }

    return false;
  }

  async waitForPortToBeBusy(port: number, timeout = 30000, protocol?: string): Promise<boolean> {
    const checkInterval = 250;
    const startTime = Date.now();

    // Perform an initial check immediately
    let isAvailable = await this.isPortAvailable(port, protocol);
    if (!isAvailable) {
      return true;
    }

    // If timeout is 0 and not immediately busy, return false
    if (timeout === 0) {
      return false;
    }

    // Use time-based loop instead of iteration count
    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      isAvailable = await this.isPortAvailable(port, protocol);
      if (!isAvailable) {
        return true;
      }
    }

    return false;
  }
}
