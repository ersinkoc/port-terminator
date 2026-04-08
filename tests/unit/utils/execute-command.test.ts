import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('executeCommand', () => {
  let mockSpawn: jest.Mock;
  let mockChildProcess: any;
  let stdoutEmitter: EventEmitter;
  let stderrEmitter: EventEmitter;

  beforeEach(() => {
    stdoutEmitter = new EventEmitter();
    stderrEmitter = new EventEmitter();

    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = stdoutEmitter;
    mockChildProcess.stderr = stderrEmitter;
    mockChildProcess.kill = jest.fn();

    mockSpawn = childProcess.spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockChildProcess);

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should resolve with stdout when command completes successfully', async () => {
    const promise = executeCommand('test-cmd', ['arg1']);

    stdoutEmitter.emit('data', Buffer.from('test output'));
    mockChildProcess.emit('close', 0);

    const result = await promise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('test output');
    expect(result.stderr).toBe('');
  });

  it('should reject with stderr when command fails with non-zero exit code', async () => {
    const promise = executeCommand('test-cmd', ['arg1']);

    stderrEmitter.emit('data', Buffer.from('error output'));
    mockChildProcess.emit('close', 1);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    await expect(promise).rejects.toThrow('Command execution failed: test-cmd arg1 (exit code: 1)');
  });

  it('should reject when command emits an error event', async () => {
    const promise = executeCommand('test-cmd', ['arg1']);

    mockChildProcess.emit('error', new Error('spawn failed'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
  });

  it('should kill process and reject when timeout is reached', async () => {
    const promise = executeCommand('test-cmd', ['arg1'], { timeoutMs: 1000 });

    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (err: any) {
      expect(err.stderr).toBe('Command timed out after 1000ms');
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should kill process and reject when stdout exceeds maxBuffer limit', async () => {
    const maxBuffer = 10;
    const promise = executeCommand('test-cmd', ['arg1'], { maxBuffer });

    // Emit exactly 10 bytes (should be fine)
    stdoutEmitter.emit('data', Buffer.from('1234567890'));

    // Emit 1 more byte, exceeding maxBuffer
    stdoutEmitter.emit('data', Buffer.from('1'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (err: any) {
      expect(err.stderr).toBe(`Command exceeded maximum buffer size of ${maxBuffer} bytes`);
    }

    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should kill process and reject when stderr exceeds maxBuffer limit', async () => {
    const maxBuffer = 5;
    const promise = executeCommand('test-cmd', ['arg1'], { maxBuffer });

    // Emit 6 bytes, exceeding maxBuffer
    stderrEmitter.emit('data', Buffer.from('123456'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
    } catch (err: any) {
      expect(err.stderr).toBe(`Command stderr exceeded maximum buffer size of ${maxBuffer} bytes`);
    }

    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
