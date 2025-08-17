export class PortTerminatorError extends Error {
  public readonly code: string;
  public readonly port?: number;
  public readonly pid?: number;

  constructor(message: string, code: string, port?: number, pid?: number) {
    super(message);
    this.name = 'PortTerminatorError';
    this.code = code;
    this.port = port;
    this.pid = pid;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProcessNotFoundError extends PortTerminatorError {
  constructor(port: number) {
    super(`No process found running on port ${port}`, 'PROCESS_NOT_FOUND', port);
    this.name = 'ProcessNotFoundError';
  }
}

export class PermissionError extends PortTerminatorError {
  constructor(message: string, pid?: number) {
    super(message, 'PERMISSION_DENIED', undefined, pid);
    this.name = 'PermissionError';
  }
}

export class PlatformError extends PortTerminatorError {
  constructor(platform: string, message?: string) {
    super(message || `Unsupported platform: ${platform}`, 'PLATFORM_UNSUPPORTED');
    this.name = 'PlatformError';
  }
}

export class TimeoutError extends PortTerminatorError {
  constructor(operation: string, timeout: number) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, 'OPERATION_TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class InvalidPortError extends PortTerminatorError {
  constructor(port: number | string) {
    super(
      `Invalid port number: ${port}. Port must be between 1 and 65535`,
      'INVALID_PORT',
      typeof port === 'number' ? port : undefined
    );
    this.name = 'InvalidPortError';
  }
}

export class CommandExecutionError extends PortTerminatorError {
  public readonly command: string;
  public readonly exitCode: number;
  public readonly stderr: string;

  constructor(command: string, exitCode: number, stderr: string) {
    super(
      `Command execution failed: ${command} (exit code: ${exitCode})`,
      'COMMAND_EXECUTION_FAILED'
    );
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class ProcessKillError extends PortTerminatorError {
  constructor(pid: number, signal?: string) {
    super(
      `Failed to kill process ${pid}${signal ? ` with signal ${signal}` : ''}`,
      'PROCESS_KILL_FAILED',
      undefined,
      pid
    );
    this.name = 'ProcessKillError';
  }
}
