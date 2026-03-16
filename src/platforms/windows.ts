import type { IPlatformImplementation, IProcessInfo } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';
import { executeCommand } from '../utils/execute-command';
import { deduplicateProcesses } from '../utils/process-utils';
import { validatePort, validatePID, normalizeProtocol } from '../utils/validators';

export class WindowsPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    const validatedPort = validatePort(port);
    const normalizedProtocol = normalizeProtocol(protocol);
    const processes: IProcessInfo[] = [];

    try {
      const netstatResult = await this.execCmd('netstat', ['-ano']);
      const lines = netstatResult.stdout.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('Active') || trimmedLine.startsWith('Proto')) {
          continue;
        }

        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 5) continue;

        const [proto, localAddress, , state, pidStr] = parts;

        if (normalizedProtocol !== 'both') {
          const expectedProto = normalizedProtocol.toUpperCase();
          if (!proto.startsWith(expectedProto)) {
            continue;
          }
        }

        const portMatch = localAddress.match(/:(\d+)$/);
        if (!portMatch) continue;

        const localPort = parseInt(portMatch[1], 10);
        if (localPort !== validatedPort) continue;

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

      return deduplicateProcesses(processes);
    } catch (error) {
      throw new CommandExecutionError(
        'netstat -ano',
        1,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async killProcess(pid: number, force = false): Promise<boolean> {
    validatePID(pid);
    try {
      const args = force ? ['/F', '/PID', pid.toString()] : ['/PID', pid.toString()];
      await this.execCmd('taskkill', args);

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
    const validatedPort = validatePort(port);
    const normalizedProtocol = normalizeProtocol(protocol);
    const processes = await this.findProcessesByPort(validatedPort, normalizedProtocol);
    return processes.length === 0;
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    validatePID(pid);
    try {
      const result = await this.execCmd('tasklist', [
        '/FI',
        `PID eq ${pid}`,
        '/FO',
        'CSV',
        '/NH',
      ]);

      // tasklist returns "INFO: No tasks..." when PID doesn't exist
      const output = result.stdout.trim();
      return output.length > 0 && !output.includes('INFO:') && output.includes(pid.toString());
    } catch {
      // If command fails, process doesn't exist
      return false;
    }
  }

  private execCmd(command: string, args: string[]) {
    return executeCommand(command, args, { windowsHide: true });
  }

  private async getProcessName(pid: number): Promise<string> {
    try {
      const result = await this.execCmd('tasklist', [
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
      const result = await this.execCmd('wmic', [
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
      // Query for the process owner using tasklist /V
      const result = await this.execCmd('tasklist', [
        '/FI',
        `PID eq ${pid}`,
        '/FO',
        'CSV',
        '/NH',
        '/V',
      ]);

      const lines = result.stdout.trim().split('\n');
      if (lines.length > 0) {
        const csvLine = lines[0];
        const parts = this.parseCSVLine(csvLine);
        // In verbose mode, the username is typically in column 6 or 7
        // Format: ImageName, PID, SessionName, Session#, MemUsage, Status, UserName, CPUTime, WindowTitle
        if (parts.length > 6) {
          const username = parts[6];
          return username !== 'N/A' ? username : undefined;
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async waitForProcessToExit(pid: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.execCmd('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
        // tasklist returns "INFO: No tasks..." when PID doesn't exist
        if (result.stdout.includes('INFO:') || !result.stdout.includes(pid.toString())) {
          return;
        }
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
