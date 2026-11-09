import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import { spawn } from 'child_process';

jest.mock('child_process');

describe('executeCommand', () => {
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve with output on successful command execution', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    const promise = executeCommand('echo', ['test']);

    // Extract event handlers
    const stdoutOn = mockChildProcess.stdout.on.mock.calls.find((call) => call[0] === 'data')[1];
    const onClose = mockChildProcess.on.mock.calls.find((call) => call[0] === 'close')[1];

    // Simulate stdout data
    stdoutOn(Buffer.from('test output'));

    // Simulate close with exit code 0
    onClose(0);

    const result = await promise;
    expect(result).toEqual({
      stdout: 'test output',
      stderr: '',
      exitCode: 0,
    });
  });

  it('should reject with CommandExecutionError on command failure', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    const promise = executeCommand('ls', ['nonexistent']);

    const stderrOn = mockChildProcess.stderr.on.mock.calls.find((call) => call[0] === 'data')[1];
    const onClose = mockChildProcess.on.mock.calls.find((call) => call[0] === 'close')[1];

    stderrOn(Buffer.from('ls: nonexistent: No such file or directory'));
    onClose(1);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (e: any) {
      expect(e.stderr).toContain('ls: nonexistent: No such file or directory');
    }
  });

  it('should reject with CommandExecutionError when stdout exceeds maxBuffer', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    const maxBuffer = 100;
    const promise = executeCommand('cat', ['largefile'], { maxBuffer });

    const stdoutOn = mockChildProcess.stdout.on.mock.calls.find((call) => call[0] === 'data')[1];

    // Simulate stdout exceeding maxBuffer
    stdoutOn(Buffer.alloc(101));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (e: any) {
      expect(e.stderr).toContain(`stdout maxBuffer exceeded (${maxBuffer} bytes)`);
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should reject with CommandExecutionError when stderr exceeds maxBuffer', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    const maxBuffer = 100;
    const promise = executeCommand('cat', ['errorfile'], { maxBuffer });

    const stderrOn = mockChildProcess.stderr.on.mock.calls.find((call) => call[0] === 'data')[1];

    // Simulate stderr exceeding maxBuffer
    stderrOn(Buffer.alloc(101));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (e: any) {
      expect(e.stderr).toContain(`stderr maxBuffer exceeded (${maxBuffer} bytes)`);
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should reject when process timeouts', async () => {
    jest.useFakeTimers();

    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    const promise = executeCommand('sleep', ['10'], { timeoutMs: 1000 });

    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (e: any) {
      expect(e.stderr).toContain('Command timed out after 1000ms');
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

    jest.useRealTimers();
  });
});
