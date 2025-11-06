export enum ErrorCode {
  PROCESS_NOT_FOUND = 'PROCESS_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PLATFORM_UNSUPPORTED = 'PLATFORM_UNSUPPORTED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  INVALID_PORT = 'INVALID_PORT',
  COMMAND_EXECUTION_FAILED = 'COMMAND_EXECUTION_FAILED',
  PROCESS_KILL_FAILED = 'PROCESS_KILL_FAILED',
}

export class PortTerminatorError extends Error {
  public readonly code: string;
  public readonly port?: number | string;
  public readonly pid?: number;

  constructor(message: string, code: string, port?: number | string, pid?: number) {
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
    super(`No process found running on port ${port}`, ErrorCode.PROCESS_NOT_FOUND, port);
    this.name = 'ProcessNotFoundError';
  }
}

export class PermissionError extends PortTerminatorError {
  constructor(message: string, pid?: number) {
    super(message, ErrorCode.PERMISSION_DENIED, undefined, pid);
    this.name = 'PermissionError';
  }
}

export class PlatformError extends PortTerminatorError {
  constructor(platform: string, message?: string) {
    super(message || `Unsupported platform: ${platform}`, ErrorCode.PLATFORM_UNSUPPORTED);
    this.name = 'PlatformError';
  }
}

export class TimeoutError extends PortTerminatorError {
  constructor(operation: string, timeout: number) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, ErrorCode.OPERATION_TIMEOUT);
    this.name = 'TimeoutError';
  }
}

export class InvalidPortError extends PortTerminatorError {
  constructor(port: number | string) {
    // Only preserve port value if it's a number or a parseable numeric string
    const portValue = typeof port === 'number' ? port :
                      (!isNaN(parseInt(port, 10)) && isFinite(parseInt(port, 10))) ? port :
                      undefined;

    super(
      `Invalid port number: ${port}. Port must be between 1 and 65535`,
      ErrorCode.INVALID_PORT,
      portValue
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
      ErrorCode.COMMAND_EXECUTION_FAILED
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
      ErrorCode.PROCESS_KILL_FAILED,
      undefined,
      pid
    );
    this.name = 'ProcessKillError';
  }
}
