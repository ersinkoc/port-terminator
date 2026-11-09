import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import * as os from 'os';

describe('executeCommand', () => {
  it('should successfully execute a simple command', async () => {
    const isWindows = os.platform() === 'win32';
    const result = isWindows
      ? await executeCommand('cmd.exe', ['/c', 'echo', 'hello']) // Mocking standard command or we can just use node
      : await executeCommand('echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('should successfully execute node process', async () => {
    const result = await executeCommand('node', ['-e', 'console.log("hello")']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('should reject with CommandExecutionError when maxBuffer is exceeded on stdout', async () => {
    let error: CommandExecutionError | undefined;
    try {
      await executeCommand('node', ['-e', 'console.log("a".repeat(2 * 1024))'], { maxBuffer: 1024 });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error?.stderr).toMatch(/exceeded maximum buffer size/);
  });

  it('should reject with CommandExecutionError when maxBuffer is exceeded on stderr', async () => {
    let error: CommandExecutionError | undefined;
    try {
      await executeCommand('node', ['-e', 'console.error("a".repeat(2 * 1024))'], { maxBuffer: 1024 });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error?.stderr).toMatch(/exceeded maximum buffer size/);
  });
});
