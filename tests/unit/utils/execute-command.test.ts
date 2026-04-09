import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';

describe('executeCommand', () => {
  it('should successfully execute a basic command', async () => {
    const result = await executeCommand('echo', ['hello world']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello world');
    expect(result.stderr).toBe('');
  });

  it('should return stderr output and throw error for failing commands', async () => {
    try {
      await executeCommand('ls', ['/nonexistent/path/12345']);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect((error as CommandExecutionError).message).toContain('ls /nonexistent/path/12345');
      // On linux, stderr from 'ls' when a file does not exist contains 'No such file or directory'
      expect((error as CommandExecutionError).stderr).toContain('No such file or directory');
    }
  });

  it('should throw an error if stdout maxBuffer is exceeded', async () => {
    const smallBuffer = 10;
    try {
      await executeCommand('echo', ['this is a long string that exceeds maxBuffer'], { maxBuffer: smallBuffer });
      fail('Should have thrown maxBuffer exceeded error');
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect((error as CommandExecutionError).stderr).toContain(`stdout maxBuffer exceeded (${smallBuffer} bytes)`);
    }
  });

  it('should throw an error if stderr maxBuffer is exceeded', async () => {
    const smallBuffer = 10;
    try {
      // Send a long string to stderr
      await executeCommand('bash', ['-c', 'echo "this is a long string that exceeds maxBuffer on stderr" >&2'], { maxBuffer: smallBuffer });
      fail('Should have thrown maxBuffer exceeded error');
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect((error as CommandExecutionError).stderr).toContain(`stderr maxBuffer exceeded (${smallBuffer} bytes)`);
    }
  });

  it('should timeout when command takes longer than timeoutMs', async () => {
    try {
      await executeCommand('sleep', ['2'], { timeoutMs: 100 });
      fail('Should have timed out');
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect((error as CommandExecutionError).stderr).toContain('Command timed out after 100ms');
    }
  });
});
