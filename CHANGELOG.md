# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-28

### Added
- Initial release of @oxog/port-terminator
- Cross-platform port termination support (Windows, macOS, Linux)
- Zero runtime dependencies implementation
- CLI interface with `port-terminator` and `pt` commands
- Programmatic API with PortTerminator class
- Support for TCP, UDP, and both protocols
- Graceful and force termination modes
- Process discovery and information gathering
- Port availability checking
- Custom timeout configurations
- JSON output support for CLI
- Dry run mode for safe preview
- Comprehensive error handling with custom error classes
- Full TypeScript support with type definitions
- 100% test coverage
- Extensive documentation (README, API, CLI, Platform guides)
- Performance benchmarks
- Usage examples for various scenarios

### Features
- **CLI Commands**: `port-terminator` and `pt` (short alias)
- **Core API**: `PortTerminator` class with full configuration options
- **Convenience Functions**: `killPort()`, `killPorts()`, `getProcessOnPort()`, etc.
- **Process Discovery**: Find processes by port across all platforms
- **Cross-Platform**: Native implementations for Windows, macOS, and Linux
- **Protocol Support**: Target TCP, UDP, or both protocols
- **Termination Modes**: Graceful shutdown with fallback to force termination
- **Port Management**: Check availability, wait for ports, scan ranges
- **Error Handling**: Comprehensive error types with detailed messages
- **Logging**: Configurable colored console output
- **Validation**: Input validation for ports, ranges, and options

### CLI Options
- `-r, --range <start-end>`: Kill processes in port range
- `-f, --force`: Force kill without graceful timeout
- `-t, --timeout <ms>`: Overall operation timeout
- `-g, --graceful-timeout <ms>`: Graceful shutdown timeout
- `-m, --method <protocol>`: Protocol to target (tcp/udp/both)
- `-n, --dry-run`: Preview mode without actual termination
- `-j, --json`: JSON output format
- `-s, --silent`: Suppress all output except errors
- `-h, --help`: Show help message
- `-v, --version`: Show version number

### Programmatic API
- `PortTerminator` class for advanced usage
- `killPort(port, options)` for simple port termination
- `killPorts(ports, options)` for multiple port termination
- `getProcessOnPort(port, options)` for process information
- `isPortAvailable(port, options)` for availability checking
- `waitForPort(port, timeout, options)` for waiting operations

### Platform Support
- **Windows**: Uses `netstat -ano` and `taskkill`
- **macOS**: Uses `lsof` and `kill` signals with fallback to `netstat`
- **Linux**: Uses `lsof` with `netstat` fallback, supports various distributions

### Error Types
- `PortTerminatorError`: Base error class
- `ProcessNotFoundError`: No process found on port
- `PermissionError`: Insufficient permissions
- `PlatformError`: Unsupported platform
- `TimeoutError`: Operation timeout
- `InvalidPortError`: Invalid port number
- `CommandExecutionError`: System command failure
- `ProcessKillError`: Process termination failure

### Documentation
- Comprehensive README with usage examples
- Complete API reference documentation
- Detailed CLI usage guide
- Platform-specific implementation notes
- Contributing guidelines
- Performance benchmarks

### Examples
- Basic usage examples (CommonJS and ESM)
- Advanced development workflow automation
- Docker container port management
- CLI scripting examples
- Error handling patterns

### Development
- TypeScript implementation with strict type checking
- ESLint and Prettier configuration
- Jest testing with 100% coverage
- GitHub Actions CI/CD pipeline
- Cross-platform testing (Windows, macOS, Linux)
- Node.js 14+ compatibility

### Performance
- Optimized platform-specific implementations
- Concurrent operation support
- Minimal memory footprint
- Efficient command execution
- Connection pooling where applicable

### Security
- Input validation and sanitization
- Safe command execution (no shell injection)
- Permission error handling
- Secure process identification

## [Unreleased]

### Planned Features
- Plugin system for custom process matchers
- Event emitter for termination progress
- Network namespace awareness on Linux
- Enhanced Docker container detection
- Configuration file support
- Shell completion scripts
- Integration with popular development tools

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.