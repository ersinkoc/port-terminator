import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';

describe('executeCommand', () => {
  it('should execute a command successfully', async () => {
    const result = await executeCommand('node', ['-e', 'console.log("hello")']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('should enforce maxBuffer on stdout', async () => {
    // A command that produces more than 10 bytes of output
    const promise = executeCommand('node', ['-e', 'console.log("0123456789ABCDEF")'], { maxBuffer: 10 });

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (error: any) {
      expect(error.stderr).toContain('exceeded maxBuffer limit of 10 bytes');
    }
  });

  it('should enforce maxBuffer on stderr', async () => {
    // A command that produces more than 10 bytes of stderr output
    const promise = executeCommand('node', ['-e', 'console.error("0123456789ABCDEF")'], { maxBuffer: 10 });

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (error: any) {
      expect(error.stderr).toContain('exceeded maxBuffer limit of 10 bytes');
    }
  });
});
