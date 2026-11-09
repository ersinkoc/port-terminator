import { executeCommand } from '../../../src/utils/execute-command';
import { CommandExecutionError } from '../../../src/errors';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('executeCommand', () => {
  let mockChildProcess: any;
  let mockStdout: EventEmitter;
  let mockStderr: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStdout = new EventEmitter();
    mockStderr = new EventEmitter();

    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = mockStdout;
    mockChildProcess.stderr = mockStderr;
    mockChildProcess.kill = jest.fn();

    (childProcess.spawn as jest.Mock).mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should successfully execute a command and return stdout', async () => {
    const promise = executeCommand('echo', ['hello']);

    mockStdout.emit('data', Buffer.from('hello\n'));
    mockChildProcess.emit('close', 0);

    const result = await promise;
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(childProcess.spawn).toHaveBeenCalledWith('echo', ['hello'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
    });
  });

  it('should throw CommandExecutionError if maxBuffer limit is exceeded on stdout', async () => {
    const promise = executeCommand('echo', ['large_output'], { maxBuffer: 10 });

    // Emit 15 bytes, which exceeds maxBuffer of 10
    mockStdout.emit('data', Buffer.alloc(15, 'a'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    // The CommandExecutionError constructor sets message to "Command execution failed..."
    // but the actual stderr property receives our custom message, so we check the property directly
    try {
      await promise;
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect(error.stderr).toMatch(/maxBuffer limit/);
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should throw CommandExecutionError if maxBuffer limit is exceeded on stderr', async () => {
    const promise = executeCommand('echo', ['large_error'], { maxBuffer: 10 });

    // Emit 15 bytes, which exceeds maxBuffer of 10
    mockStderr.emit('data', Buffer.alloc(15, 'a'));

    await expect(promise).rejects.toThrow(CommandExecutionError);
    try {
      await promise;
      fail('Expected promise to reject');
    } catch (error: any) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect(error.stderr).toMatch(/maxBuffer limit/);
    }
    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
