import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process.spawn
jest.mock('child_process');

describe('executeCommand', () => {
  let mockSpawn: jest.Mock;
  let mockChildProcess: any;

  beforeEach(() => {
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = jest.fn();

    mockSpawn = child_process.spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should resolve with stdout, stderr, and exitCode 0 on success', async () => {
    const promise = executeCommand('echo', ['hello']);

    mockChildProcess.stdout.emit('data', Buffer.from('hello\n'));
    mockChildProcess.emit('close', 0);

    const result = await promise;
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
  });

  it('should reject with CommandExecutionError on non-zero exit code', async () => {
    const promise = executeCommand('ls', ['/nonexistent']);

    mockChildProcess.stderr.emit('data', Buffer.from('No such file or directory\n'));
    mockChildProcess.emit('close', 1);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    await expect(promise).rejects.toThrow('Command execution failed');
  });

  it('should reject with CommandExecutionError when stdout exceeds maxBuffer', async () => {
    const promise = executeCommand('echo', ['lots of data'], { maxBuffer: 10 });

    mockChildProcess.stdout.emit('data', Buffer.from('12345678901')); // 11 bytes

    const error = await promise.catch(e => e);
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.stderr).toContain('stdout maxBuffer exceeded');
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should reject with CommandExecutionError when stderr exceeds maxBuffer', async () => {
    const promise = executeCommand('echo', ['lots of error data'], { maxBuffer: 10 });

    mockChildProcess.stderr.emit('data', Buffer.from('12345678901')); // 11 bytes

    const error = await promise.catch(e => e);
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.stderr).toContain('stderr maxBuffer exceeded');
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should timeout and reject with CommandExecutionError', async () => {
    jest.useFakeTimers();

    const promise = executeCommand('sleep', ['10'], { timeoutMs: 100 });

    jest.advanceTimersByTime(101);

    const error = await promise.catch(e => e);
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect(error.stderr).toContain('Command timed out');
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
