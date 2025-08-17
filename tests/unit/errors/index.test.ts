import {
  PortTerminatorError,
  ProcessNotFoundError,
  PermissionError,
  PlatformError,
  TimeoutError,
  InvalidPortError,
  CommandExecutionError,
  ProcessKillError,
} from '../../../src/errors';

describe('Error Classes', () => {
  describe('PortTerminatorError', () => {
    it('should create error with message and code', () => {
      const error = new PortTerminatorError('Test message', 'TEST_CODE');

      expect(error.name).toBe('PortTerminatorError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.port).toBeUndefined();
      expect(error.pid).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
    });

    it('should create error with port information', () => {
      const error = new PortTerminatorError('Test message', 'TEST_PORT', 3000);

      expect(error.port).toBe(3000);
      expect(error.pid).toBeUndefined();
    });

    it('should create error with pid information', () => {
      const error = new PortTerminatorError('Test message', 'TEST_PID', undefined, 1234);

      expect(error.port).toBeUndefined();
      expect(error.pid).toBe(1234);
    });

    it('should create error with both port and pid', () => {
      const error = new PortTerminatorError('Test message', 'TEST_BOTH', 3000, 1234);

      expect(error.port).toBe(3000);
      expect(error.pid).toBe(1234);
    });

    it('should capture stack trace', () => {
      const error = new PortTerminatorError('Test message', 'TEST_STACK');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('PortTerminatorError');
    });
  });

  describe('ProcessNotFoundError', () => {
    it('should create error with port', () => {
      const error = new ProcessNotFoundError(3000);

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('ProcessNotFoundError');
      expect(error.message).toBe('No process found running on port 3000');
      expect(error.code).toBe('PROCESS_NOT_FOUND');
      expect(error.port).toBe(3000);
      expect(error.pid).toBeUndefined();
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new ProcessNotFoundError(8080);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('PermissionError', () => {
    it('should create error with message only', () => {
      const error = new PermissionError('Access denied');

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('PermissionError');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.port).toBeUndefined();
      expect(error.pid).toBeUndefined();
    });

    it('should create error with message and pid', () => {
      const error = new PermissionError('Access denied for process', 1234);

      expect(error.message).toBe('Access denied for process');
      expect(error.pid).toBe(1234);
      expect(error.port).toBeUndefined();
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new PermissionError('Test message', 5678);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('PlatformError', () => {
    it('should create error with platform name only', () => {
      const error = new PlatformError('freebsd');

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('PlatformError');
      expect(error.message).toBe('Unsupported platform: freebsd');
      expect(error.code).toBe('PLATFORM_UNSUPPORTED');
    });

    it('should create error with custom message', () => {
      const error = new PlatformError('aix', 'AIX is not supported in this version');

      expect(error.message).toBe('AIX is not supported in this version');
      expect(error.code).toBe('PLATFORM_UNSUPPORTED');
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new PlatformError('unknown');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('TimeoutError', () => {
    it('should create error with operation and timeout', () => {
      const error = new TimeoutError('waitForPort(3000)', 30000);

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe("Operation 'waitForPort(3000)' timed out after 30000ms");
      expect(error.code).toBe('OPERATION_TIMEOUT');
    });

    it('should handle different operation types', () => {
      const error = new TimeoutError('killProcess(1234)', 5000);

      expect(error.message).toBe("Operation 'killProcess(1234)' timed out after 5000ms");
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new TimeoutError('test', 1000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('InvalidPortError', () => {
    it('should create error with numeric port', () => {
      const error = new InvalidPortError(70000);

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('InvalidPortError');
      expect(error.message).toBe('Invalid port number: 70000. Port must be between 1 and 65535');
      expect(error.code).toBe('INVALID_PORT');
      expect(error.port).toBe(70000);
    });

    it('should create error with string port', () => {
      const error = new InvalidPortError('invalid');

      expect(error.message).toBe('Invalid port number: invalid. Port must be between 1 and 65535');
      expect(error.port).toBeUndefined();
    });

    it('should create error with zero port', () => {
      const error = new InvalidPortError(0);

      expect(error.message).toBe('Invalid port number: 0. Port must be between 1 and 65535');
      expect(error.port).toBe(0);
    });

    it('should create error with negative port', () => {
      const error = new InvalidPortError(-1);

      expect(error.message).toBe('Invalid port number: -1. Port must be between 1 and 65535');
      expect(error.port).toBe(-1);
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new InvalidPortError(99999);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('CommandExecutionError', () => {
    it('should create error with command, exit code, and stderr', () => {
      const error = new CommandExecutionError('kill -9 1234', 1, 'No such process');

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('CommandExecutionError');
      expect(error.message).toBe('Command execution failed: kill -9 1234 (exit code: 1)');
      expect(error.code).toBe('COMMAND_EXECUTION_FAILED');
      expect(error.command).toBe('kill -9 1234');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('No such process');
    });

    it('should handle different commands and exit codes', () => {
      const error = new CommandExecutionError('netstat -an', 127, 'Command not found');

      expect(error.message).toBe('Command execution failed: netstat -an (exit code: 127)');
      expect(error.command).toBe('netstat -an');
      expect(error.exitCode).toBe(127);
      expect(error.stderr).toBe('Command not found');
    });

    it('should handle empty stderr', () => {
      const error = new CommandExecutionError('lsof -i :3000', 1, '');

      expect(error.stderr).toBe('');
      expect(error.message).toBe('Command execution failed: lsof -i :3000 (exit code: 1)');
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new CommandExecutionError('test command', 1, 'error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('ProcessKillError', () => {
    it('should create error with pid only', () => {
      const error = new ProcessKillError(1234);

      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.name).toBe('ProcessKillError');
      expect(error.message).toBe('Failed to kill process 1234');
      expect(error.code).toBe('PROCESS_KILL_FAILED');
      expect(error.port).toBeUndefined();
      expect(error.pid).toBe(1234);
    });

    it('should create error with pid and signal', () => {
      const error = new ProcessKillError(5678, 'SIGKILL');

      expect(error.message).toBe('Failed to kill process 5678 with signal SIGKILL');
      expect(error.pid).toBe(5678);
    });

    it('should handle different signals', () => {
      const error = new ProcessKillError(9999, 'SIGTERM');

      expect(error.message).toBe('Failed to kill process 9999 with signal SIGTERM');
    });

    it('should inherit all PortTerminatorError properties', () => {
      const error = new ProcessKillError(1111, 'SIGINT');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PortTerminatorError);
      expect(error.stack).toBeDefined();
    });
  });

  describe('Error inheritance and polymorphism', () => {
    it('should allow catching all errors as PortTerminatorError', () => {
      const errors = [
        new ProcessNotFoundError(3000),
        new PermissionError('Access denied'),
        new PlatformError('unsupported'),
        new TimeoutError('test', 1000),
        new InvalidPortError(0),
        new CommandExecutionError('test', 1, 'error'),
        new ProcessKillError(1234),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(PortTerminatorError);
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.name).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    });

    it('should allow instanceof checks for specific error types', () => {
      const processNotFound = new ProcessNotFoundError(3000);
      const permission = new PermissionError('denied');
      const platform = new PlatformError('unknown');
      const timeout = new TimeoutError('op', 1000);
      const invalidPort = new InvalidPortError(0);
      const commandExecution = new CommandExecutionError('cmd', 1, 'err');
      const processKill = new ProcessKillError(1234);

      expect(processNotFound).toBeInstanceOf(ProcessNotFoundError);
      expect(permission).toBeInstanceOf(PermissionError);
      expect(platform).toBeInstanceOf(PlatformError);
      expect(timeout).toBeInstanceOf(TimeoutError);
      expect(invalidPort).toBeInstanceOf(InvalidPortError);
      expect(commandExecution).toBeInstanceOf(CommandExecutionError);
      expect(processKill).toBeInstanceOf(ProcessKillError);

      // All should also be instances of base class
      [
        processNotFound,
        permission,
        platform,
        timeout,
        invalidPort,
        commandExecution,
        processKill,
      ].forEach((error) => {
        expect(error).toBeInstanceOf(PortTerminatorError);
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should preserve error chain in stack traces', () => {
      const error = new ProcessNotFoundError(3000);

      expect(error.stack).toContain('ProcessNotFoundError');
      expect(error.stack).toContain(__filename);
    });
  });

  describe('Error serialization', () => {
    it('should serialize error properties correctly', () => {
      const error = new CommandExecutionError('test command', 1, 'stderr output');

      // Error objects need custom serialization since message is not enumerable
      const errorObj = {
        name: error.name,
        message: error.message,
        code: error.code,
        command: error.command,
        exitCode: error.exitCode,
        stderr: error.stderr,
      };
      const serialized = JSON.stringify(errorObj);
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('CommandExecutionError');
      expect(parsed.message).toBe('Command execution failed: test command (exit code: 1)');
      expect(parsed.code).toBe('COMMAND_EXECUTION_FAILED');
      expect(parsed.command).toBe('test command');
      expect(parsed.exitCode).toBe(1);
      expect(parsed.stderr).toBe('stderr output');
    });

    it('should serialize PortTerminatorError with port and pid', () => {
      const error = new PortTerminatorError('test', 'TEST', 3000, 1234);

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.port).toBe(3000);
      expect(parsed.pid).toBe(1234);
      expect(parsed.code).toBe('TEST');
    });
  });
});
