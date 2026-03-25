import type { IProcessInfo, IPlatformImplementation } from '../types';
import { getPlatform } from '../utils/platform';
import { WindowsPlatform } from '../platforms/windows';
import { MacOSPlatform } from '../platforms/macos';
import { LinuxPlatform } from '../platforms/linux';
import { PlatformError } from '../errors';
import { validatePort, validatePorts, normalizeProtocol } from '../utils/validators';

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
    const validPort = validatePort(port);
    const validProto = normalizeProtocol(protocol);
    return this.platform.findProcessesByPort(validPort, validProto);
  }

  async findByPorts(ports: number[], protocol?: string): Promise<Map<number, IProcessInfo[]>> {
    const validPorts = validatePorts(ports);
    const validProto = normalizeProtocol(protocol);
    const results = new Map<number, IProcessInfo[]>();

    await Promise.all(
      validPorts.map(async (port) => {
        try {
          const processes = await this.findByPort(port, validProto);
          results.set(port, processes);
        } catch (error) {
          // Silently handle errors - continue with other ports
          results.set(port, []);
        }
      })
    );

    return results;
  }

  async isPortAvailable(port: number, protocol?: string): Promise<boolean> {
    const validPort = validatePort(port);
    const validProto = normalizeProtocol(protocol);
    return this.platform.isPortAvailable(validPort, validProto);
  }

  async waitForPortToBeAvailable(
    port: number,
    timeout = 30000,
    protocol?: string
  ): Promise<boolean> {
    const validPort = validatePort(port);
    const validProto = normalizeProtocol(protocol);
    const checkInterval = 250;
    const startTime = Date.now();

    // Perform an initial check immediately
    let isAvailable = await this.isPortAvailable(validPort, validProto);
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
      isAvailable = await this.isPortAvailable(validPort, validProto);
      if (isAvailable) {
        return true;
      }
    }

    return false;
  }

  async waitForPortToBeBusy(port: number, timeout = 30000, protocol?: string): Promise<boolean> {
    const validPort = validatePort(port);
    const validProto = normalizeProtocol(protocol);
    const checkInterval = 250;
    const startTime = Date.now();

    // Perform an initial check immediately
    let isAvailable = await this.isPortAvailable(validPort, validProto);
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
      isAvailable = await this.isPortAvailable(validPort, validProto);
      if (!isAvailable) {
        return true;
      }
    }

    return false;
  }
}
