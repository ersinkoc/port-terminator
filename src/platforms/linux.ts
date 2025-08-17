import { spawn } from 'child_process';
import type { IPlatformImplementation, IProcessInfo, ICommandResult } from '../types';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../errors';

export class LinuxPlatform implements IPlatformImplementation {
  async findProcessesByPort(port: number, protocol = 'both'): Promise<IProcessInfo[]> {
    let processes: IProcessInfo[] = [];

    try {
      processes = await this.findWithLsof(port, protocol);
    } catch (error) {
      processes = await this.findWithNetstat(port, protocol);
    }

    return this.deduplicateProcesses(processes);
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

  private async findWithLsof(port: number, protocol: string): Promise<IProcessInfo[]> {
    const processes: IProcessInfo[] = [];
    const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];

    for (const proto of protocols) {
      try {
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

      const netstatResult = await this.executeCommand('netstat', args);
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

        const processCommand = pid > 0 ? await this.getProcessCommand(pid) : undefined;
        const processUser = pid > 0 ? await this.getProcessUser(pid) : undefined;

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

  private async executeCommand(command: string, args: string[]): Promise<ICommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
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

  private async getProcessCommand(pid: number): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('ps', ['-p', pid.toString(), '-o', 'command=']);
      return result.stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async getProcessUser(pid: number): Promise<string | undefined> {
    try {
      const result = await this.executeCommand('ps', ['-p', pid.toString(), '-o', 'user=']);
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
