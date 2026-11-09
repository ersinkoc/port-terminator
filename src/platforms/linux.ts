import type { IPlatformImplementation, IProcessInfo } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';
import { executeCommand } from '../utils/execute-command';
import { deduplicateProcesses } from '../utils/process-utils';
import { validatePort, validatePID, normalizeProtocol } from '../utils/validators';

export class LinuxPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    // Defense-in-depth: validate inputs before using them in commands
    const safePort = validatePort(port);
    const safeProtocol = normalizeProtocol(protocol);

    let processes: IProcessInfo[] = [];

    try {
      processes = await this.findWithLsof(safePort, safeProtocol);
    } catch (error) {
      processes = await this.findWithNetstat(safePort, safeProtocol);
    }

    return deduplicateProcesses(processes);
  }

  async killProcess(pid: number, force = false): Promise<boolean> {
    // Defense-in-depth: validate PID before using it in commands
    validatePID(pid);

    try {
      if (!force) {
        try {
          await executeCommand('kill', ['-TERM', pid.toString()]);
          await this.waitForProcessToExit(pid, 5000);
          return true;
        } catch {
          // Fall through to force kill
        }
      }

      await executeCommand('kill', ['-KILL', pid.toString()]);
      await this.waitForProcessToExit(pid, 2000);
      return true;
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        if (error.stderr.includes('Operation not permitted')) {
          throw new PermissionError(`Permission denied when trying to kill process ${pid}`, pid);
        }
        if (error.stderr.includes('No such process')) {
          return true;
        }
      }
      throw new ProcessKillError(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
  }

  async isPortAvailable(port: number, protocol = 'both'): Promise<boolean> {
    // findProcessesByPort already validates the inputs
    const processes = await this.findProcessesByPort(port, protocol);
    return processes.length === 0;
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    // Defense-in-depth: validate PID before using it in commands
    validatePID(pid);

    try {
      // Use kill -0 to check if process exists without actually killing it
      await executeCommand('kill', ['-0', pid.toString()]);
      return true;
    } catch {
      // If command fails, process doesn't exist
      return false;
    }
  }

  private async findWithLsof(port: number, protocol: string): Promise<IProcessInfo[]> {
    const processes: IProcessInfo[] = [];
    const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];

    for (const proto of protocols) {
      try {
        const lsofResult = await executeCommand('lsof', [
          '-i',
          `${proto}:${port}`,
          '-P',
          '-n',
        ]);
        const lines = lsofResult.stdout.split('\n');

        for (const line of lines) {
          if (!line.trim() || line.startsWith('COMMAND')) {
            continue;
          }

          const parts = line.trim().split(/\s+/);
          if (parts.length < 9) continue;

          const [command, pidStr, user, , , , , , name] = parts;
          const pid = parseInt(pidStr, 10);

          if (isNaN(pid)) continue;

          if (!name.includes(`:${port}`)) continue;

          const processCommand = await this.getProcessCommand(pid);

          processes.push({
            pid,
            name: command,
            port,
            protocol: proto,
            command: processCommand,
            user,
          });
        }
      } catch (error) {
        // Continue with next protocol
      }
    }

    return processes;
  }

  private async findWithNetstat(port: number, protocol: string): Promise<IProcessInfo[]> {
    const processes: IProcessInfo[] = [];

    try {
      const args = ['-tulpn'];
      if (protocol !== 'both') {
        args.push(`--${protocol}`);
      }

      const netstatResult = await executeCommand('netstat', args);
      const lines = netstatResult.stdout.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Active') || trimmed.startsWith('Proto')) {
          continue;
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length < 7) continue;

        const [proto, , , localAddress, , , processInfo] = parts;

        if (protocol !== 'both' && !proto.toLowerCase().includes(protocol)) {
          continue;
        }

        const portMatch = localAddress.match(/:(\d+)$/);
        if (!portMatch) continue;

        const localPort = parseInt(portMatch[1], 10);
        if (localPort !== port) continue;

        let pid = 0;
        let processName = 'Unknown';

        if (processInfo && processInfo !== '-') {
          const processMatch = processInfo.match(/^(\d+)\/(.+)$/);
          if (processMatch) {
            pid = parseInt(processMatch[1], 10);
            processName = processMatch[2];
          }
        }

        // Skip processes with PID 0 (cannot be killed)
        if (pid === 0) {
          continue;
        }

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
      }

      return processes;
    } catch (error) {
      return [];
    }
  }

  private async getProcessCommand(pid: number): Promise<string | undefined> {
    try {
      const result = await executeCommand('ps', ['-p', pid.toString(), '-o', 'command=']);
      return result.stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async getProcessUser(pid: number): Promise<string | undefined> {
    try {
      const result = await executeCommand('ps', ['-p', pid.toString(), '-o', 'user=']);
      return result.stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async waitForProcessToExit(pid: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await executeCommand('kill', ['-0', pid.toString()]);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        return;
      }
    }
  }
}
