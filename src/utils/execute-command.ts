import { spawn } from 'child_process';
import type { ICommandResult } from '../types';
import { CommandExecutionError } from '../errors';

/**
 * Executes a command using child_process.spawn and returns the result.
 * This is a shared utility extracted from platform-specific implementations
 * to eliminate code duplication (previously duplicated 3x across linux.ts,
 * macos.ts, and windows.ts).
 *
 * Uses spawn with argument arrays to prevent shell injection attacks.
 *
 * @param command - The command to execute
 * @param args - Array of arguments for the command
 * @param options - Optional configuration
 * @param options.timeoutMs - Command timeout in milliseconds (default: 30000)
 * @param options.windowsHide - Hide the subprocess window on Windows (default: false)
 * @param options.maxBuffer - Maximum buffer size in bytes for stdout/stderr (default: 1048576)
 * @returns Promise resolving to command result with stdout, stderr, and exitCode
 * @throws {CommandExecutionError} If the command fails or times out
 */
export function executeCommand(
  command: string,
  args: string[],
  options: { timeoutMs?: number; windowsHide?: boolean; maxBuffer?: number } = {}
): Promise<ICommandResult> {
  const { timeoutMs = 30000, windowsHide = false, maxBuffer = 1048576 } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide,
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

    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length + data.length > maxBuffer) {
        if (!isResolved) {
          isResolved = true;
          child.kill('SIGKILL');
          clearTimeout(timeout);
          reject(new CommandExecutionError(`${command} ${args.join(' ')}`, 1, `maxBuffer size exceeded`));
        }
        return;
      }
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length + data.length > maxBuffer) {
        if (!isResolved) {
          isResolved = true;
          child.kill('SIGKILL');
          clearTimeout(timeout);
          reject(new CommandExecutionError(`${command} ${args.join(' ')}`, 1, `maxBuffer size exceeded`));
        }
        return;
      }
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      if (killTimeout) {
        clearTimeout(killTimeout);
        killTimeout = null;
      }

      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new CommandExecutionError(`${command} ${args.join(' ')}`, code || 1, stderr));
        }
      }
    });

    child.on('error', (error: Error) => {
      if (killTimeout) {
        clearTimeout(killTimeout);
        killTimeout = null;
      }

      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        reject(new CommandExecutionError(`${command} ${args.join(' ')}`, 1, error.message));
      }
    });
  });
}
