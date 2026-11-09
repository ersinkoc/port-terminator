import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';

describe('executeCommand', () => {
  it('should successfully execute a command and return stdout', async () => {
    const result = await executeCommand('node', ['-e', 'console.log("hello world")']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.stderr).toBe('');
  });

  it('should return stderr for commands that output to stderr', async () => {
    const result = await executeCommand('node', ['-e', 'console.error("error output")']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('error output');
    expect(result.stdout).toBe('');
  });

  it('should throw CommandExecutionError for failing commands', async () => {
    await expect(executeCommand('node', ['-e', 'process.exit(1)'])).rejects.toThrow(
      CommandExecutionError
    );
  });

  it('should throw CommandExecutionError on timeout', async () => {
    try {
      await executeCommand('node', ['-e', 'setTimeout(() => {}, 2000)'], { timeoutMs: 100 });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CommandExecutionError);
      expect((err as CommandExecutionError).stderr).toContain('timed out');
    }
  });

  it('should throw CommandExecutionError when stdout exceeds maxBuffer', async () => {
    // Generate an output larger than 10 bytes
    try {
      await executeCommand('node', ['-e', 'console.log("A".repeat(20))'], { maxBuffer: 10 });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CommandExecutionError);
      expect((err as CommandExecutionError).stderr).toContain('stdout maxBuffer exceeded');
    }
  });

  it('should throw CommandExecutionError when stderr exceeds maxBuffer', async () => {
    // Generate an error output larger than 10 bytes
    try {
      await executeCommand('node', ['-e', 'console.error("B".repeat(20))'], { maxBuffer: 10 });
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CommandExecutionError);
      expect((err as CommandExecutionError).stderr).toContain('stderr maxBuffer exceeded');
    }
  });
});
