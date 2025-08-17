# API Documentation

## Table of Contents

- [PortTerminator Class](#portterminator-class)
- [ProcessFinder Class](#processfinder-class)
- [ProcessKiller Class](#processkiller-class)
- [PortScanner Class](#portscanner-class)
- [Convenience Functions](#convenience-functions)
- [Types and Interfaces](#types-and-interfaces)
- [Error Classes](#error-classes)
- [Utilities](#utilities)

## PortTerminator Class

The main class for terminating processes on specified ports.

### Constructor

```typescript
constructor(options?: IPortTerminatorOptions)
```

Creates a new PortTerminator instance with the specified options.

**Parameters:**
- `options` (optional): Configuration options

**Example:**
```typescript
const terminator = new PortTerminator({
  method: 'tcp',
  force: false,
  gracefulTimeout: 5000,
  timeout: 30000,
  silent: false
});
```

### Methods

#### terminate(port)

```typescript
terminate(port: number | number[]): Promise<boolean>
```

Terminates processes running on the specified port(s).

**Parameters:**
- `port`: Single port number or array of port numbers

**Returns:** Promise that resolves to `true` if all processes were successfully terminated

**Example:**
```typescript
// Single port
await terminator.terminate(3000);

// Multiple ports
await terminator.terminate([3000, 8080, 9000]);
```

#### terminateMultiple(ports)

```typescript
terminateMultiple(ports: number[]): Promise<Map<number, boolean>>
```

Terminates processes on multiple ports and returns detailed results.

**Parameters:**
- `ports`: Array of port numbers

**Returns:** Promise that resolves to a Map with port numbers as keys and success status as values

**Example:**
```typescript
const results = await terminator.terminateMultiple([3000, 8080]);
console.log(results.get(3000)); // true or false
```

#### terminateWithDetails(ports)

```typescript
terminateWithDetails(ports: number[]): Promise<ITerminationResult[]>
```

Terminates processes and returns detailed information about each operation.

**Parameters:**
- `ports`: Array of port numbers

**Returns:** Promise that resolves to an array of termination results

**Example:**
```typescript
const results = await terminator.terminateWithDetails([3000, 8080]);
results.forEach(result => {
  console.log(`Port ${result.port}: ${result.success ? 'Success' : 'Failed'}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
});
```

#### getProcesses(port)

```typescript
getProcesses(port: number): Promise<IProcessInfo[]>
```

Retrieves information about all processes running on the specified port.

**Parameters:**
- `port`: Port number to query

**Returns:** Promise that resolves to an array of process information

**Example:**
```typescript
const processes = await terminator.getProcesses(3000);
processes.forEach(process => {
  console.log(`PID: ${process.pid}, Name: ${process.name}`);
});
```

#### isPortAvailable(port)

```typescript
isPortAvailable(port: number): Promise<boolean>
```

Checks if the specified port is available (no processes running on it).

**Parameters:**
- `port`: Port number to check

**Returns:** Promise that resolves to `true` if the port is available

**Example:**
```typescript
const available = await terminator.isPortAvailable(3000);
if (available) {
  console.log('Port 3000 is available');
}
```

#### waitForPort(port, timeout?)

```typescript
waitForPort(port: number, timeout?: number): Promise<boolean>
```

Waits for the specified port to become available.

**Parameters:**
- `port`: Port number to wait for
- `timeout` (optional): Maximum time to wait in milliseconds

**Returns:** Promise that resolves to `true` if the port becomes available within the timeout

**Throws:** `TimeoutError` if the port doesn't become available within the timeout

**Example:**
```typescript
try {
  await terminator.waitForPort(3000, 10000); // Wait up to 10 seconds
  console.log('Port 3000 is now available');
} catch (error) {
  console.log('Timeout waiting for port 3000');
}
```

## ProcessFinder Class

Class for finding processes running on specified ports.

### Constructor

```typescript
constructor()
```

Creates a ProcessFinder instance with automatic platform detection.

### Methods

#### findByPort(port, protocol?)

```typescript
findByPort(port: number, protocol?: string): Promise<IProcessInfo[]>
```

Finds all processes running on the specified port.

**Parameters:**
- `port`: Port number to search
- `protocol` (optional): Protocol to filter by ('tcp', 'udp', or 'both')

**Returns:** Promise that resolves to an array of process information

#### findByPorts(ports, protocol?)

```typescript
findByPorts(ports: number[], protocol?: string): Promise<Map<number, IProcessInfo[]>>
```

Finds processes running on multiple ports.

**Parameters:**
- `ports`: Array of port numbers
- `protocol` (optional): Protocol to filter by

**Returns:** Promise that resolves to a Map with port numbers as keys and process arrays as values

#### isPortAvailable(port, protocol?)

```typescript
isPortAvailable(port: number, protocol?: string): Promise<boolean>
```

Checks if a port is available.

#### waitForPortToBeAvailable(port, timeout?, protocol?)

```typescript
waitForPortToBeAvailable(port: number, timeout?: number, protocol?: string): Promise<boolean>
```

Waits for a port to become available.

#### waitForPortToBeBusy(port, timeout?, protocol?)

```typescript
waitForPortToBeBusy(port: number, timeout?: number, protocol?: string): Promise<boolean>
```

Waits for a port to become busy (have processes running on it).

## ProcessKiller Class

Class for terminating processes.

### Constructor

```typescript
constructor()
```

Creates a ProcessKiller instance with automatic platform detection.

### Methods

#### killProcess(pid, force?, gracefulTimeout?)

```typescript
killProcess(pid: number, force?: boolean, gracefulTimeout?: number): Promise<boolean>
```

Kills a specific process by PID.

**Parameters:**
- `pid`: Process ID to kill
- `force` (optional): Whether to force kill immediately
- `gracefulTimeout` (optional): Time to wait for graceful shutdown

#### killProcesses(pids, force?, gracefulTimeout?)

```typescript
killProcesses(pids: number[], force?: boolean, gracefulTimeout?: number): Promise<Map<number, boolean>>
```

Kills multiple processes by their PIDs.

#### killProcessesByPort(port, force?, gracefulTimeout?, protocol?)

```typescript
killProcessesByPort(port: number, force?: boolean, gracefulTimeout?: number, protocol?: string): Promise<IProcessInfo[]>
```

Kills all processes running on the specified port.

#### killProcessesByPorts(ports, force?, gracefulTimeout?, protocol?)

```typescript
killProcessesByPorts(ports: number[], force?: boolean, gracefulTimeout?: number, protocol?: string): Promise<Map<number, IProcessInfo[]>>
```

Kills processes running on multiple ports.

## PortScanner Class

Class for scanning and analyzing port usage.

### Constructor

```typescript
constructor()
```

Creates a PortScanner instance.

### Methods

#### scanPort(port, protocol?)

```typescript
scanPort(port: number, protocol?: string): Promise<{
  port: number;
  available: boolean;
  processes: IProcessInfo[];
}>
```

Scans a single port for process information.

#### scanPorts(ports, protocol?)

```typescript
scanPorts(ports: number[], protocol?: string): Promise<Map<number, {
  port: number;
  available: boolean;
  processes: IProcessInfo[];
}>>
```

Scans multiple ports.

#### scanPortRange(start, end, protocol?)

```typescript
scanPortRange(start: number, end: number, protocol?: string): Promise<{
  range: string;
  availablePorts: number[];
  busyPorts: Map<number, IProcessInfo[]>;
}>
```

Scans a range of ports.

#### findAvailablePort(startPort?, maxAttempts?, protocol?)

```typescript
findAvailablePort(startPort?: number, maxAttempts?: number, protocol?: string): Promise<number | null>
```

Finds the next available port starting from a given port.

#### findAvailablePorts(count, startPort?, maxAttempts?, protocol?)

```typescript
findAvailablePorts(count: number, startPort?: number, maxAttempts?: number, protocol?: string): Promise<number[]>
```

Finds multiple available ports.

## Convenience Functions

### killPort(port, options?)

```typescript
killPort(port: number, options?: IPortTerminatorOptions): Promise<boolean>
```

Simple function to kill processes on a single port.

### killPorts(ports, options?)

```typescript
killPorts(ports: number[], options?: IPortTerminatorOptions): Promise<Map<number, boolean>>
```

Simple function to kill processes on multiple ports.

### getProcessOnPort(port, options?)

```typescript
getProcessOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo | null>
```

Gets the first process running on the specified port.

### getProcessesOnPort(port, options?)

```typescript
getProcessesOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo[]>
```

Gets all processes running on the specified port.

### isPortAvailable(port, options?)

```typescript
isPortAvailable(port: number, options?: IPortTerminatorOptions): Promise<boolean>
```

Checks if a port is available.

### waitForPort(port, timeout?, options?)

```typescript
waitForPort(port: number, timeout?: number, options?: IPortTerminatorOptions): Promise<boolean>
```

Waits for a port to become available.

## Types and Interfaces

### IPortTerminatorOptions

Configuration options for PortTerminator instances.

```typescript
interface IPortTerminatorOptions {
  method?: 'tcp' | 'udp' | 'both';    // Protocol to target (default: 'both')
  timeout?: number;                    // Overall operation timeout (default: 30000)
  force?: boolean;                     // Force kill without graceful timeout (default: false)
  silent?: boolean;                    // Suppress logging output (default: false)
  gracefulTimeout?: number;            // Graceful shutdown timeout (default: 5000)
}
```

### IProcessInfo

Information about a process running on a port.

```typescript
interface IProcessInfo {
  pid: number;           // Process ID
  name: string;          // Process name
  port: number;          // Port number
  protocol: string;      // Protocol ('tcp' or 'udp')
  command?: string;      // Full command line (if available)
  user?: string;         // User running the process (if available)
}
```

### ITerminationResult

Result of a port termination operation.

```typescript
interface ITerminationResult {
  port: number;                    // Port number
  success: boolean;                // Whether termination was successful
  processes: IProcessInfo[];       // Processes that were terminated
  error?: string;                  // Error message if termination failed
}
```

### ICliOptions

CLI command line options.

```typescript
interface ICliOptions {
  ports?: number[];                // Port numbers to target
  range?: string;                  // Port range (e.g., "3000-3005")
  force?: boolean;                 // Force kill flag
  timeout?: number;                // Operation timeout
  dryRun?: boolean;                // Dry run flag
  json?: boolean;                  // JSON output flag
  silent?: boolean;                // Silent flag
  help?: boolean;                  // Help flag
  version?: boolean;               // Version flag
  method?: 'tcp' | 'udp' | 'both'; // Protocol method
  gracefulTimeout?: number;        // Graceful timeout
}
```

## Error Classes

### PortTerminatorError

Base error class for all port-terminator errors.

```typescript
class PortTerminatorError extends Error {
  public readonly code: string;
  public readonly port?: number;
  public readonly pid?: number;
}
```

### ProcessNotFoundError

Thrown when no process is found on the specified port.

```typescript
class ProcessNotFoundError extends PortTerminatorError {
  constructor(port: number);
}
```

### PermissionError

Thrown when insufficient permissions to kill a process.

```typescript
class PermissionError extends PortTerminatorError {
  constructor(message: string, pid?: number);
}
```

### PlatformError

Thrown when the current platform is not supported.

```typescript
class PlatformError extends PortTerminatorError {
  constructor(platform: string, message?: string);
}
```

### TimeoutError

Thrown when an operation times out.

```typescript
class TimeoutError extends PortTerminatorError {
  constructor(operation: string, timeout: number);
}
```

### InvalidPortError

Thrown when an invalid port number is provided.

```typescript
class InvalidPortError extends PortTerminatorError {
  constructor(port: number | string);
}
```

### CommandExecutionError

Thrown when a system command fails to execute.

```typescript
class CommandExecutionError extends PortTerminatorError {
  public readonly command: string;
  public readonly exitCode: number;
  public readonly stderr: string;
}
```

### ProcessKillError

Thrown when failing to kill a process.

```typescript
class ProcessKillError extends PortTerminatorError {
  constructor(pid: number, signal?: string);
}
```

## Utilities

### Validation Functions

#### validatePort(port)

```typescript
validatePort(port: number | string): number
```

Validates and normalizes a port number.

#### validatePorts(ports)

```typescript
validatePorts(ports: (number | string)[]): number[]
```

Validates an array of port numbers.

#### parsePortRange(range)

```typescript
parsePortRange(range: string): number[]
```

Parses a port range string (e.g., "3000-3005") into an array of port numbers.

### Platform Functions

#### getPlatform()

```typescript
getPlatform(): Platform
```

Returns the current platform ('win32', 'darwin', or 'linux').

#### isWindows(), isMacOS(), isLinux()

```typescript
isWindows(): boolean
isMacOS(): boolean
isLinux(): boolean
```

Platform detection helper functions.

### Logger Class

#### Logger

```typescript
class Logger implements ILogger {
  constructor(level?: LogLevel, silent?: boolean);
  
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  
  setLevel(level: LogLevel): void;
  setSilent(silent: boolean): void;
}
```

Provides colored console output with configurable log levels.