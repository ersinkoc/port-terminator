import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('executeCommand', () => {
  let mockSpawn: jest.Mock;
  let mockChildProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = jest.fn();

    mockSpawn = child_process.spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  it('should resolve with stdout, stderr, and exitCode on success', async () => {
    const promise = executeCommand('test-cmd', ['arg1', 'arg2']);

    mockChildProcess.stdout.emit('data', Buffer.from('test output\n'));
    mockChildProcess.stderr.emit('data', Buffer.from(''));
    mockChildProcess.emit('close', 0);

    const result = await promise;

    expect(result).toEqual({
      stdout: 'test output\n',
      stderr: '',
      exitCode: 0,
    });
    expect(mockSpawn).toHaveBeenCalledWith('test-cmd', ['arg1', 'arg2'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
    });
  });

  it('should reject when stdout exceeds maxBuffer', async () => {
    const promise = executeCommand('test-cmd', [], { maxBuffer: 10 });

    mockChildProcess.stdout.emit('data', Buffer.from('This is a very long output that exceeds 10 bytes'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    await promise.catch(e => {
      expect(e.stderr).toMatch(/exceeded maximum buffer size of 10 bytes on stdout/);
    });
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should reject when stderr exceeds maxBuffer', async () => {
    const promise = executeCommand('test-cmd', [], { maxBuffer: 10 });

    mockChildProcess.stderr.emit('data', Buffer.from('This is a very long output that exceeds 10 bytes'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    await promise.catch(e => {
      expect(e.stderr).toMatch(/exceeded maximum buffer size of 10 bytes on stderr/);
    });
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should handle process timeout', async () => {
    jest.useFakeTimers();

    const promise = executeCommand('test-cmd', [], { timeoutMs: 1000 });

    jest.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(CommandExecutionError);
    await promise.catch(e => {
      expect(e.stderr).toMatch(/Command timed out after 1000ms/);
    });
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

    jest.useRealTimers();
  });

});
