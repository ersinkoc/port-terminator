# @oxog/port-terminator

[![npm version](https://img.shields.io/npm/v/@oxog/port-terminator)](https://www.npmjs.com/package/@oxog/port-terminator) [![npm downloads](https://img.shields.io/npm/dm/@oxog/port-terminator)](https://www.npmjs.com/package/@oxog/port-terminator) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js Version](https://img.shields.io/node/v/@oxog/port-terminator)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org)

Cross-platform utility to terminate processes running on specified ports with **zero runtime dependencies**.

---

## 📖 Table of Contents

- [🚀 Features](#-features)
- [📦 Installation](#-installation)
- [🔧 CLI Usage](#-cli-usage)
- [📚 Programmatic Usage](#-programmatic-usage)
- [🔍 API Reference](#-api-reference)
- [🔧 Platform Support](#-platform-support)
- [🧪 Examples](#-examples)
- [🎯 Use Cases](#-use-cases)
- [🔒 Security](#-security)
- [📊 Performance](#-performance)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📞 Support](#-support)

---

## 🚀 Features

- **Zero Dependencies**: No runtime dependencies, only Node.js built-in modules
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **TypeScript First**: Full TypeScript support with comprehensive type definitions
- **CLI & Programmatic**: Use as a CLI tool or import as a library
- **Graceful & Force Kill**: Supports both graceful shutdown and force termination
- **Protocol Support**: Target TCP, UDP, or both protocols
- **Comprehensive API**: Rich set of utility functions for port management
- **Production Ready**: 100% test coverage, robust error handling

## 📦 Installation

```bash
# Install globally for CLI usage
npm install -g @oxog/port-terminator

# Or install locally for programmatic usage
npm install @oxog/port-terminator
```

## 🔧 CLI Usage

The package provides two commands: `port-terminator` and its shorter alias, `pt`.

### Basic Examples

- **Kill a single port:**
  ```bash
  port-terminator 3000
  ```

- **Kill multiple ports:**
  ```bash
  pt 3000 8080 9000
  ```

- **Kill a range of ports:**
  ```bash
  port-terminator --range 3000-3005
  ```

### Advanced Examples

- **Force kill a process:**
  ```bash
  pt 3000 --force
  ```

- **Preview processes to be killed (dry run):**
  ```bash
  port-terminator 3000 --dry-run
  ```

- **Target a specific protocol (TCP/UDP):**
  ```bash
  pt 3000 --method tcp
  ```

- **Get JSON output for scripting:**
  ```bash
  port-terminator 3000 --json
  ```

### All CLI Options

| Short | Long               | Description                                           | Default |
|-------|--------------------|-------------------------------------------------------|---------|
| `-r`  | `--range`          | Kill processes in a port range (e.g., `3000-3005`)    |         |
| `-f`  | `--force`          | Force kill without a graceful timeout                 | `false` |
| `-t`  | `--timeout`        | Overall operation timeout in ms                       | `30000` |
| `-g`  | `--graceful-timeout`| Graceful shutdown timeout in ms                       | `5000`  |
| `-m`  | `--method`         | Protocol to target: `tcp`, `udp`, or `both`           | `both`  |
| `-n`  | `--dry-run`        | Show what would be killed without actually killing    | `false` |
| `-j`  | `--json`           | Output results in JSON format                         | `false` |
| `-s`  | `--silent`         | Suppress all output except errors                     | `false` |
| `-h`  | `--help`           | Show the help message                                 |         |
| `-v`  | `--version`        | Show the version number                               |         |

## 📚 Programmatic Usage

The library can be used programmatically by importing the `PortTerminator` class or the convenience functions.

### Using Convenience Functions

For simple, one-off tasks, the convenience functions are a great choice.

```typescript
import { killPort, killPorts, getProcessOnPort, isPortAvailable } from '@oxog/port-terminator';

// Kill a single port
await killPort(3000);

// Kill multiple ports and get results
const results = await killPorts([3000, 8080, 9000]);
console.log(results.get(3000)); // true or false

// Get information about a process
const process = await getProcessOnPort(3000);
if (process) {
  console.log(`Process ${process.name} (PID: ${process.pid}) is on port 3000.`);
}

// Check if a port is available
const available = await isPortAvailable(3000);
console.log(`Port 3000 is ${available ? 'free' : 'in use'}.`);
```

### Using the `PortTerminator` Class

For more complex scenarios or when you need more control, instantiate the `PortTerminator` class.

```typescript
import { PortTerminator } from '@oxog/port-terminator';

const terminator = new PortTerminator({
  method: 'tcp',          // Only target TCP processes
  force: false,           // Try graceful shutdown first
  gracefulTimeout: 5000,  // Wait 5s for graceful shutdown
});

// Get detailed termination results
const detailedResults = await terminator.terminateWithDetails([3000, 8080]);
for (const result of detailedResults) {
  if (result.success) {
    console.log(`Successfully terminated ${result.processes.length} processes on port ${result.port}.`);
  } else {
    console.error(`Failed to terminate on port ${result.port}: ${result.error}`);
  }
}

// Wait for a port to become available
try {
  await terminator.waitForPort(3000, 10000); // Wait up to 10 seconds
  console.log('Port 3000 is now available!');
} catch (err) {
  console.error(err.message);
}
```

### Port Scanning with `PortScanner`

The `PortScanner` class provides powerful tools for checking port availability.

```typescript
import { PortScanner } from '@oxog/port-terminator';

const scanner = new PortScanner();

// Scan a single port for details
const result = await scanner.scanPort(3000);
console.log(result); // { port: 3000, available: false, processes: [...] }

// Find the next available port starting from 3000
const availablePort = await scanner.findAvailablePort(3000);
console.log(`Next available port is: ${availablePort}`);

// Find 5 available ports in a given range
const rangeScan = await scanner.scanPortRange(3000, 3010);
const fivePorts = rangeScan.availablePorts.slice(0, 5);
console.log(`Found 5 available ports: ${fivePorts.join(', ')}`);
```

## 🔍 API Reference

### `PortTerminator` Class

The main class for process termination.

- `constructor(options?: IPortTerminatorOptions)`
- `terminate(port: number | number[]): Promise<boolean>`
- `terminateMultiple(ports: number[]): Promise<Map<number, boolean>>`
- `terminateWithDetails(ports: number[]): Promise<ITerminationResult[]>`
- `getProcesses(port: number): Promise<IProcessInfo[]>`
- `isPortAvailable(port: number): Promise<boolean>`
- `waitForPort(port: number, timeout?: number): Promise<boolean>`

### `PortScanner` Class

A class for scanning and finding available ports.

- `constructor(options?: IPortScannerOptions)`
- `scanPort(port: number, protocol?: 'tcp' | 'udp' | 'both'): Promise<IScanResult>`
- `scanPorts(ports: number[], protocol?: 'tcp' | 'udp' | 'both'): Promise<IScanResult[]>`
- `scanPortRange(startPort: number, endPort: number, protocol?: 'tcp' | 'udp' | 'both'): Promise<IRangeScanResult>`
- `findAvailablePort(startPort?: number, endPort?: number, protocol?: 'tcp' | 'udp' | 'both'): Promise<number | null>`
- `findAvailablePorts(count: number, startPort?: number, endPort?: number, protocol?: 'tcp' | 'udp' | 'both'): Promise<number[]>`

### Convenience Functions

- `killPort(port: number, options?: IPortTerminatorOptions): Promise<boolean>`
- `killPorts(ports: number[], options?: IPortTerminatorOptions): Promise<Map<number, boolean>>`
- `getProcessOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo | null>`
- `getProcessesOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo[]>`
- `isPortAvailable(port: number, options?: IPortTerminatorOptions): Promise<boolean>`
- `waitForPort(port: number, timeout?: number, options?: IPortTerminatorOptions): Promise<boolean>`

### Core Types

- **`IPortTerminatorOptions`**: Configuration for `PortTerminator`.
  - `method`: `'tcp' | 'udp' | 'both'` (default: `'both'`)
  - `timeout`: `number` (ms, default: `30000`)
  - `force`: `boolean` (default: `false`)
  - `silent`: `boolean` (default: `false`)
  - `gracefulTimeout`: `number` (ms, default: `5000`)

- **`IProcessInfo`**: Information about a process on a port.
  - `pid`: `number`
  - `name`: `string`
  - `port`: `number`
  - `protocol`: `string`
  - `command`: `string | undefined`
  - `user`: `string | undefined`

- **`ITerminationResult`**: Detailed result of a termination operation.
  - `port`: `number`
  - `success`: `boolean`
  - `processes`: `IProcessInfo[]`
  - `error`: `string | undefined`

## 🤔 Why Port Terminator?

While there are other tools that can kill processes on ports, `@oxog/port-terminator` is designed to be a robust, reliable, and easy-to-use solution for modern development workflows.

- **Zero Runtime Dependencies**: Ensures minimal footprint and avoids common dependency conflicts.
- **Cross-Platform from the Ground Up**: Built and tested to work consistently on Windows, macOS, and Linux.
- **TypeScript First**: Provides a great developer experience with modern TypeScript features.
- **Comprehensive & Flexible API**: Offers both high-level convenience functions and a low-level class-based API for full control.
- **Both CLI and Library**: A powerful tool for both command-line users and programmatic integration.

## 🔧 Platform Support

### Windows
- Uses `netstat -ano` to find processes
- Uses `taskkill` for termination
- Supports both TCP and UDP protocols
- Handles Windows-specific process information

### macOS
- Uses `lsof -i :<port>` to find processes (with fallback to `netstat`)
- Uses `kill` signals for termination (SIGTERM → SIGKILL)
- Full process information including command and user
- Handles macOS-specific permissions

### Linux
- Uses `lsof -i :<port>` with fallback to `netstat -tulpn`
- Uses `kill` signals for termination (SIGTERM → SIGKILL)
- Supports various Linux distributions
- Network namespace awareness

## 🧪 Examples

### Express.js Development

```typescript
import express from 'express';
import { killPort } from '@oxog/port-terminator';

async function startServer() {
  // Kill any existing process on port 3000
  await killPort(3000);
  
  const app = express();
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}
```

### Development Script

```typescript
import { PortTerminator } from '@oxog/port-terminator';

async function cleanupPorts() {
  const terminator = new PortTerminator({ 
    force: true,
    silent: true 
  });
  
  // Clean up common development ports
  const devPorts = [3000, 3001, 8080, 8081, 9000];
  const results = await terminator.terminateMultiple(devPorts);
  
  const cleaned = Array.from(results.entries())
    .filter(([_, success]) => success)
    .map(([port, _]) => port);
    
  console.log(`Cleaned ports: ${cleaned.join(', ')}`);
}
```

### Docker Container Management

```typescript
import { getProcessesOnPort, killPort } from '@oxog/port-terminator';

async function manageDockerPort(port: number) {
  const processes = await getProcessesOnPort(port);
  
  const dockerProcesses = processes.filter(p => 
    p.command?.includes('docker') || p.name?.includes('docker')
  );
  
  if (dockerProcesses.length > 0) {
    console.log(`Found Docker processes on port ${port}`);
    await killPort(port, { force: true });
  }
}
```

## 🎯 Use Cases

- **Development Workflow**: Automatically kill processes when restarting dev servers
- **CI/CD Pipelines**: Clean up ports before running tests
- **Docker Management**: Terminate containers using specific ports
- **Port Conflict Resolution**: Find and resolve port conflicts
- **System Administration**: Monitor and manage port usage
- **Testing**: Ensure clean state between test runs

## 🔒 Security

- **Input Validation**: All inputs are validated and sanitized
- **Permission Handling**: Graceful handling of permission errors
- **Safe Command Execution**: Protected against command injection
- **Error Boundaries**: Comprehensive error handling and reporting

## 📊 Performance

- **Minimal Overhead**: Zero runtime dependencies
- **Concurrent Operations**: Parallel processing for multiple ports
- **Efficient Queries**: Optimized platform-specific commands
- **Resource Management**: Proper cleanup and timeout handling

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ by [Ersin KOÇ](https://github.com/ersinkoc)
- Inspired by the need for a reliable, zero-dependency port management solution
- Thanks to all contributors and users of this package

## 📞 Support

- 📖 [Documentation](https://github.com/ersinkoc/port-terminator/tree/main/docs)
- 🐛 [Issue Tracker](https://github.com/ersinkoc/port-terminator/issues)
- 💬 [Discussions](https://github.com/ersinkoc/port-terminator/discussions)

---

<div align="center">
Made with ❤️ for the developer community.
</div>