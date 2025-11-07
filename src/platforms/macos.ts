import { spawn } from 'child_process';
import type { IPlatformImplementation, IProcessInfo, ICommandResult } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';

export class MacOSPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    const processes: IProcessInfo[] = [];

    try {
      const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];

      for (const proto of protocols) {
        const lsofResult = await this.executeCommand('lsof', [
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
      }

      return this.deduplicateProcesses(processes);
    } catch (error) {
      if (
        error instanceof CommandExecutionError &&
        error.stderr.includes('No such file or directory')
      ) {
        return this.fallbackFindProcesses(port, protocol);
      }
      throw error;
    }
  }

  async killProcess(pid: number, force = false): Promise<boolean> {
    try {
      if (!force) {
        try {
          await this.executeCommand('kill', ['-TERM', pid.toString()]);
          await this.waitForProcessToExit(pid, 5000);
          return true;
        } catch {
          // Fall through to force kill
        }
      }

      await this.executeCommand('kill', ['-KILL', pid.toString()]);
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
    const processes = await this.findProcessesByPort(port, protocol);
    return processes.length === 0;
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Use kill -0 to check if process exists without actually killing it
      await this.executeCommand('kill', ['-0', pid.toString()]);
      return true;
    } catch {
      // If command fails, process doesn't exist
      return false;
    }
  }

  private async executeCommand(
    command: string,
    args: string[],
    timeoutMs = 30000
  ): Promise<ICommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;
      let killTimeout: NodeJS.Timeout | null = null;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          child.kill('SIGTERM');
          killTimeout = setTimeout(() => child.kill('SIGKILL'), 5000);
          reject(
            new CommandExecutionError(
              `${command} ${args.join(' ')}`,
              1,
              `Command timed out after ${timeoutMs}ms`
            )
          );
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          if (killTimeout) clearTimeout(killTimeout);
          if (code === 0) {
            resolve({ stdout, stderr, exitCode: code });
          } else {
            reject(new CommandExecutionError(`${command} ${args.join(' ')}`, code || 1, stderr));
          }
        }
      });

      child.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          if (killTimeout) clearTimeout(killTimeout);
          reject(new CommandExecutionError(`${command} ${args.join(' ')}`, 1, error.message));
        }
      });
    });
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
        const netstatResult = await this.executeCommand('netstat', [
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
            // Mark as found but continue checking other protocols
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
      const result = await this.executeCommand('ps', ['-p', pid.toString(), '-o', 'command=']);
      return result.stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async waitForProcessToExit(pid: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await this.executeCommand('kill', ['-0', pid.toString()]);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch {
        return;
      }
    }
  }

  private deduplicateProcesses(processes: IProcessInfo[]): IProcessInfo[] {
    const seen = new Set<string>();
    return processes.filter((process) => {
      const key = `${process.pid}-${process.port}-${process.protocol}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
