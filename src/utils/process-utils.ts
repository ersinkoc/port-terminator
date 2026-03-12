import type { IProcessInfo } from '../types';

/**
 * Removes duplicate processes from an array based on pid-port-protocol combination.
 * Shared utility extracted from platform-specific implementations.
 */
export function deduplicateProcesses(processes: IProcessInfo[]): IProcessInfo[] {
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

/**
 * Waits for a process to exit by polling a check function.
 * @param checkRunning - Async function that returns true if the process is still running
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForProcessExit(
  checkRunning: () => Promise<boolean>,
  timeout: number
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const isRunning = await checkRunning();
      if (!isRunning) {
        return;
      }
    } catch {
      // If check fails, assume process has exited
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
