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
