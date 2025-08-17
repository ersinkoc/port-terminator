# @oxog/port-terminator

[![npm version](https://img.shields.io/npm/v/@oxog/port-terminator)](https://www.npmjs.com/package/@oxog/port-terminator) [![npm downloads](https://img.shields.io/npm/dm/@oxog/port-terminator)](https://www.npmjs.com/package/@oxog/port-terminator) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js Version](https://img.shields.io/node/v/@oxog/port-terminator)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org)

Cross-platform utility to terminate processes running on specified ports with **zero runtime dependencies**.

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

The package provides both `port-terminator` and `pt` (short alias) commands:

```bash
# Kill process on single port
port-terminator 3000

# Kill processes on multiple ports
port-terminator 3000 8080 9000

# Kill processes in a port range
port-terminator --range 3000-3005

# Force kill without graceful timeout
port-terminator 3000 --force

# Preview what would be killed (dry run)
port-terminator 3000 --dry-run

# Kill only TCP processes
port-terminator 3000 --method tcp

# Get JSON output
port-terminator 3000 --json

# Using short alias
pt 3000
```

### CLI Options

```
-r, --range <start-end>     Kill processes in port range (e.g., 3000-3005)
-f, --force                 Force kill without graceful timeout
-t, --timeout <ms>          Overall operation timeout (default: 30000)
-g, --graceful-timeout <ms> Graceful shutdown timeout (default: 5000)
-m, --method <protocol>     Protocol to target: tcp, udp, or both (default: both)
-n, --dry-run               Show what would be killed without actually killing
-j, --json                  Output results in JSON format
-s, --silent                Suppress all output except errors
-h, --help                  Show help message
-v, --version               Show version number
```

## 📚 Programmatic Usage

### Basic Usage

```typescript
import { PortTerminator, killPort, killPorts, getProcessOnPort } from '@oxog/port-terminator';

// Simple one-liner to kill a port
await killPort(3000);

// Kill multiple ports
await killPorts([3000, 8080, 9000]);

// Get process information
const process = await getProcessOnPort(3000);
console.log(process); // { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', ... }
```

### Advanced Usage

```typescript
import { PortTerminator } from '@oxog/port-terminator';

const terminator = new PortTerminator({
  method: 'tcp',           // Only target TCP processes
  force: false,            // Try graceful shutdown first
  gracefulTimeout: 5000,   // Wait 5s for graceful shutdown
  timeout: 30000,          // Overall operation timeout
  silent: false            // Enable logging
});

// Terminate with detailed results
const results = await terminator.terminateWithDetails([3000, 8080]);
console.log(results);
/*
[
  {
    port: 3000,
    success: true,
    processes: [{ pid: 1234, name: 'node', ... }]
  },
  {
    port: 8080,
    success: false,
    processes: [],
    error: "Permission denied"
  }
]
*/

// Check if port is available
const isAvailable = await terminator.isPortAvailable(3000);

// Wait for port to become available
await terminator.waitForPort(3000, 10000); // Wait up to 10 seconds

// Get all processes on a port
const processes = await terminator.getProcesses(3000);
```

### Port Scanning & Management

```typescript
import { PortScanner } from '@oxog/port-terminator';

const scanner = new PortScanner();

// Scan a single port
const result = await scanner.scanPort(3000);
console.log(result); // { port: 3000, available: false, processes: [...] }

// Scan multiple ports
const results = await scanner.scanPorts([3000, 8080, 9000]);

// Scan a port range
const rangeResult = await scanner.scanPortRange(3000, 3010);
console.log(rangeResult.availablePorts); // [3002, 3004, 3007, ...]

// Find next available port
const availablePort = await scanner.findAvailablePort(3000); // Returns 3001 if 3000 is busy

// Find multiple available ports
const availablePorts = await scanner.findAvailablePorts(5, 3000); // Find 5 available ports starting from 3000
```

## 🔍 API Reference

### PortTerminator Class

```typescript
class PortTerminator {
  constructor(options?: IPortTerminatorOptions);
  
  // Terminate processes on port(s)
  terminate(port: number | number[]): Promise<boolean>;
  terminateMultiple(ports: number[]): Promise<Map<number, boolean>>;
  terminateWithDetails(ports: number[]): Promise<ITerminationResult[]>;
  
  // Query operations
  getProcesses(port: number): Promise<IProcessInfo[]>;
  isPortAvailable(port: number): Promise<boolean>;
  waitForPort(port: number, timeout?: number): Promise<boolean>;
}
```

### Convenience Functions

```typescript
// Simple termination functions
killPort(port: number, options?: IPortTerminatorOptions): Promise<boolean>;
killPorts(ports: number[], options?: IPortTerminatorOptions): Promise<Map<number, boolean>>;

// Query functions
getProcessOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo | null>;
getProcessesOnPort(port: number, options?: IPortTerminatorOptions): Promise<IProcessInfo[]>;
isPortAvailable(port: number, options?: IPortTerminatorOptions): Promise<boolean>;
waitForPort(port: number, timeout?: number, options?: IPortTerminatorOptions): Promise<boolean>;
```

### Types

```typescript
interface IPortTerminatorOptions {
  method?: 'tcp' | 'udp' | 'both';  // Default: 'both'
  timeout?: number;                  // Default: 30000
  force?: boolean;                   // Default: false
  silent?: boolean;                  // Default: false
  gracefulTimeout?: number;          // Default: 5000
}

interface IProcessInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
  command?: string;
  user?: string;
}

interface ITerminationResult {
  port: number;
  success: boolean;
  processes: IProcessInfo[];
  error?: string;
}
```

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
Made with ❤️ for the developer community
</div>