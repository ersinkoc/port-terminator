export interface IPortTerminatorOptions {
  method?: 'tcp' | 'udp' | 'both';
  timeout?: number;
  force?: boolean;
  silent?: boolean;
  gracefulTimeout?: number;
}

export interface IProcessInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
  command?: string;
  user?: string;
}

export interface IPlatformImplementation {
  findProcessesByPort(port: number, protocol?: string): Promise<IProcessInfo[]>;
  killProcess(pid: number, force?: boolean): Promise<boolean>;
  isPortAvailable(port: number, protocol?: string): Promise<boolean>;
}

export interface ICommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ICliOptions {
  ports?: number[];
  range?: string;
  force?: boolean;
  timeout?: number;
  dryRun?: boolean;
  json?: boolean;
  silent?: boolean;
  help?: boolean;
  version?: boolean;
  method?: 'tcp' | 'udp' | 'both';
  gracefulTimeout?: number;
}

export interface ITerminationResult {
  port: number;
  success: boolean;
  processes: IProcessInfo[];
  error?: string;
}

export type Platform = 'win32' | 'darwin' | 'linux';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface ILogger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  setLevel(level: LogLevel): void;
  setSilent(silent: boolean): void;
}
