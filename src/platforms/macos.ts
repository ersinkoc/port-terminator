import type { IPlatformImplementation, IProcessInfo } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';
import { executeCommand } from '../utils/execute-command';
import { deduplicateProcesses } from '../utils/process-utils';
import { validatePort, validatePID, normalizeProtocol } from '../utils/validators';

export class MacOSPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    // Defense-in-depth: validate inputs before using them in commands
    const safePort = validatePort(port);
    const safeProtocol = normalizeProtocol(protocol);

    const processes: IProcessInfo[] = [];

    try {
      const protocols = safeProtocol === 'both' ? ['tcp', 'udp'] : [safeProtocol];

      for (const proto of protocols) {
        const lsofResult = await executeCommand('lsof', [
          '-i',
          `${proto}:${safePort}`,
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

          if (!name.includes(`:${safePort}`)) continue;

          const processCommand = await this.getProcessCommand(pid);

          processes.push({
            pid,
            name: command,
            port: safePort,
            protocol: proto,
            command: processCommand,
            user,
          });
        }
      }

      return deduplicateProcesses(processes);
    } catch (error) {
      if (
        error instanceof CommandExecutionError &&
        error.stderr.includes('No such file or directory')
      ) {
        return this.fallbackFindProcesses(safePort, safeProtocol);
      }
      throw error;
    }
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

  private async fallbackFindProcesses(port: number, protocol: string): Promise<IProcessInfo[]> {
    // WARNING: netstat fallback cannot determine PIDs on macOS
    // We cannot kill processes without PIDs, so we throw an error
    // instead of returning processes with PID 0
    const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];
    let portFound = false;

    // Check all protocols before throwing error
    for (const proto of protocols) {
      try {
        const netstatResult = await executeCommand('netstat', [
          '-an',
          '-p',
          proto,
        ]);
        const lines = netstatResult.stdout.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('Active') || trimmed.startsWith('Proto')) {
            continue;
          }

          const parts = trimmed.split(/\s+/);
          if (parts.length < 6) continue;

          const [protoName, , , localAddress] = parts;

          if (!protoName.toLowerCase().includes(proto)) {
            continue;
          }

          const portMatch = localAddress.match(/\.(\d+)$/);
          if (!portMatch) continue;

          const localPort = parseInt(portMatch[1], 10);
          if (localPort === port) {
            // Port is in use but we cannot determine PID
            portFound = true;
            break;
          }
        }
      } catch (error) {
        if (error instanceof CommandExecutionError) {
          throw error;
        }
        // Continue to next protocol
      }
    }

    // If port was found in any protocol, throw error since we can't get PID
    if (portFound) {
      throw new CommandExecutionError(
        'lsof (fallback to netstat)',
        1,
        'Process found on port but cannot determine PID. lsof command not available.'
      );
    }

    // Port not found in netstat output
    return [];
  }

  private async getProcessCommand(pid: number): Promise<string | undefined> {
    try {
      const result = await executeCommand('ps', ['-p', pid.toString(), '-o', 'command=']);
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
