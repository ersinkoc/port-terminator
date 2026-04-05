import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';

describe('executeCommand', () => {
  it('should execute a valid command and return its output', async () => {
    const result = await executeCommand('node', ['-e', 'console.log("hello world")']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.stderr).toBe('');
  });

  it('should throw CommandExecutionError if maxBuffer for stdout is exceeded', async () => {
    const script = `
      for(let i=0; i<10000; i++) {
        console.log("x".repeat(1024)); // 10MB total
      }
    `;

    await expect(
      executeCommand('node', ['-e', script], { maxBuffer: 1024 * 512 }) // 512 KB
    ).rejects.toThrow(CommandExecutionError);

    try {
      await executeCommand('node', ['-e', script], { maxBuffer: 1024 * 512 });
    } catch (e: any) {
      expect(e.stderr).toContain('stdout maxBuffer exceeded');
    }
  });

  it('should throw CommandExecutionError if maxBuffer for stderr is exceeded', async () => {
    const script = `
      for(let i=0; i<10000; i++) {
        console.error("x".repeat(1024)); // 10MB total
      }
    `;

    await expect(
      executeCommand('node', ['-e', script], { maxBuffer: 1024 * 512 }) // 512 KB
    ).rejects.toThrow(CommandExecutionError);

    try {
      await executeCommand('node', ['-e', script], { maxBuffer: 1024 * 512 });
    } catch (e: any) {
      expect(e.stderr).toContain('stderr maxBuffer exceeded');
    }
  });

  it('should reject with CommandExecutionError if command fails', async () => {
    await expect(executeCommand('node', ['-e', 'process.exit(1)'])).rejects.toThrow(
      CommandExecutionError
    );
  });
});
