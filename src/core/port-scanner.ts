import { ProcessFinder } from './process-finder';
import type { IProcessInfo } from '../types';

export class PortScanner {
  private processFinder: ProcessFinder;

  constructor() {
    this.processFinder = new ProcessFinder();
  }

  async scanPort(
    port: number,
    protocol?: string
  ): Promise<{
    port: number;
    available: boolean;
    processes: IProcessInfo[];
  }> {
    const processes = await this.processFinder.findByPort(port, protocol);

    return {
      port,
      available: processes.length === 0,
      processes,
    };
  }

  async scanPorts(
    ports: number[],
    protocol?: string
  ): Promise<
    Map<
      number,
      {
        port: number;
        available: boolean;
        processes: IProcessInfo[];
      }
    >
  > {
    const results = new Map();

    await Promise.all(
      ports.map(async (port) => {
        const result = await this.scanPort(port, protocol);
        results.set(port, result);
      })
    );

    return results;
  }

  async scanPortRange(
    start: number,
    end: number,
    protocol?: string
  ): Promise<{
    range: string;
    availablePorts: number[];
    busyPorts: Map<number, IProcessInfo[]>;
  }> {
    const ports: number[] = [];

    for (let port = start; port <= end; port++) {
      ports.push(port);
    }

    const scanResults = await this.scanPorts(ports, protocol);
    const availablePorts: number[] = [];
    const busyPorts = new Map<number, IProcessInfo[]>();

    for (const [port, result] of scanResults) {
      if (result.available) {
        availablePorts.push(port);
      } else {
        busyPorts.set(port, result.processes);
      }
    }

    return {
      range: `${start}-${end}`,
      availablePorts,
      busyPorts,
    };
  }

  async findAvailablePort(
    startPort = 3000,
    maxAttempts = 100,
    protocol?: string
  ): Promise<number | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;

      // Stop if we exceed the maximum valid port number
      if (port > 65535) {
        break;
      }

      const isAvailable = await this.processFinder.isPortAvailable(port, protocol);

      if (isAvailable) {
        return port;
      }
    }

    return null;
  }

  async findAvailablePorts(
    count: number,
    startPort = 3000,
    maxAttempts = 1000,
    protocol?: string
  ): Promise<number[]> {
    const availablePorts: number[] = [];
    let attempts = 0;
    let currentPort = startPort;

    while (availablePorts.length < count && attempts < maxAttempts) {
      // Stop if we exceed the maximum valid port number
      if (currentPort > 65535) {
        break;
      }

      const isAvailable = await this.processFinder.isPortAvailable(currentPort, protocol);

      if (isAvailable) {
        availablePorts.push(currentPort);
      }

      currentPort++;
      attempts++;
    }

    return availablePorts;
  }
}
