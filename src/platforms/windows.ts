import { spawn } from 'child_process';
import type { IPlatformImplementation, IProcessInfo, ICommandResult } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';

export class WindowsPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    const processes: IProcessInfo[] = [];

    try {
      const netstatResult = await this.executeCommand('netstat', ['-ano']);
      const lines = netstatResult.stdout.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('Active') || trimmedLine.startsWith('Proto')) {
          continue;
        }

        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 5) continue;

        const [proto, localAddress, , state, pidStr] = parts;

        if (protocol !== 'both') {
          const expectedProto = protocol.toUpperCase();
          if (!proto.startsWith(expectedProto)) {
            continue;
          }
        }

        const portMatch = localAddress.match(/:(\d+)$/);
        if (!portMatch) continue;

        const localPort = parseInt(portMatch[1], 10);
        if (localPort !== port) continue;

        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) continue;

        if (proto.startsWith('TCP') && state !== 'LISTENING') {
          continue;
        }

        try {
          const processName = await this.getProcessName(pid);
          const processCommand = await this.getProcessCommand(pid);
          const processUser = await this.getProcessUser(pid);

          processes.push({
            pid,
            name: processName,
            port: localPort,
            protocol: proto.toLowerCase(),
            command: processCommand,
            user: processUser,
          });
        } catch (error) {
          continue;
        }
      }

      return processes;
    } catch (error) {
      throw new CommandExecutionError(
        'netstat -ano',
        1,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async killProcess(pid: number, force = false): Promise<boolean> {
    try {
      const args = force ? ['/F', '/PID', pid.toString()] : ['/PID', pid.toString()];
      await this.executeCommand('taskkill', args);

      await this.waitForProcessToExit(pid, 5000);
      return true;
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        if (error.stderr.includes('Access is denied')) {
          throw new PermissionError(`Access denied when trying to kill process ${pid}`, pid);
        }
        if (error.stderr.includes('not found') || error.stderr.includes('not running')) {
          return true;
        }
      }
      throw new ProcessKillError(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
  }

  async isPortAvailable(port: number, protocol = 'both'): Promise<boolean> {
    const processes = await this.findProcessesByPort(port, protocol);
    return processes.length === 0;
  }

  private async executeCommand(command: string, args: string[]): Promise<ICommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new CommandExecutionError(`${command} ${args.join(' ')}`, code || 1, stderr));
        }
      });

      child.on('error', (error) => {
        reject(new CommandExecutionError(`${command} ${args.join(' ')}`, 1, error.message));
      });
    });
  }

  private async getProcessName(pid: number): Promise<string> {
    try {
      const result = await this.executeCommand('tasklist', [
        '/FI',
        `PID eq ${pid}`,
        '/FO',
        'CSV',
        '/NH',
      ]);
      const lines = result.stdout.trim().split('\n');

      if (lines.length > 0) {
        const csvLine = lines[0];
        const parts = this.parseCSVLine(csvLine);
        if (parts.length > 0) {
          return parts[0];
        }
      }

      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getProcessCommand(pid: number): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('wmic', [
        'process',
        'where',
        `ProcessId=${pid}`,
        'get',
        'CommandLine',
        '/format:value',
      ]);

      const lines = result.stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('CommandLine=')) {
          return trimmed.substring('CommandLine='.length) || undefined;
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async getProcessUser(pid: number): Promise<string | undefined> {
    try {
      await this.executeCommand('wmic', [
        'process',
        'where',
        `ProcessId=${pid}`,
        'get',
        'ExecutablePath',
        '/format:value',
      ]);

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async waitForProcessToExit(pid: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.executeCommand('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV']);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        return;
      }
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current.trim());
    }

    return result.map((item) => item.replace(/^"(.*)"$/, '$1'));
  }
}
