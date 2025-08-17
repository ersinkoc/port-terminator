# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build Commands
- `npm run build` - Build the project (CJS, ESM, and types)
- `npm run clean` - Clean the dist directory
- `npm run typecheck` - Type check without emitting

### Testing Commands
- `npm test` - Run all tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ci` - Run tests in CI mode with JUnit output
- Run a single test file: `npx jest tests/unit/core/process-finder.test.ts`
- Run tests matching pattern: `npx jest --testNamePattern="should find processes"`

### Code Quality Commands
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Benchmarking
- `npm run benchmark` - Run performance benchmarks

## High-Level Architecture

### Core Architecture Pattern
The codebase follows a modular, platform-agnostic architecture with platform-specific implementations:

1. **Main Entry Point** (`src/index.ts`): Exports the `PortTerminator` class and convenience functions. The class orchestrates process finding and killing operations using core modules.

2. **Platform Abstraction**: Platform-specific logic is isolated in `src/platforms/` with separate implementations for Windows, macOS, and Linux. Each platform module exports standardized functions that are consumed by core modules.

3. **Core Modules** (`src/core/`):
   - `ProcessFinder`: Delegates to platform-specific implementations to find processes by port
   - `ProcessKiller`: Handles graceful and force termination with platform-specific commands
   - `PortScanner`: Provides port availability checking and scanning utilities

4. **CLI Layer** (`src/cli/index.ts`): Standalone CLI implementation that uses the main library API, handling argument parsing, dry-run mode, and formatted output.

### Key Design Decisions

1. **Zero Runtime Dependencies**: The project explicitly avoids runtime dependencies, using only Node.js built-in modules (`child_process`, `net`, etc.).

2. **TypeScript-First**: Strict TypeScript configuration with comprehensive type definitions in `src/types/index.ts`.

3. **Dual Module Support**: Builds both CommonJS and ESM outputs, with proper exports configuration in package.json.

4. **Error Handling**: Custom error classes in `src/errors/` for specific error scenarios (TimeoutError, PermissionError, etc.).

5. **Process Communication**: All platform commands are executed via `child_process.exec` with careful command construction to prevent injection attacks.

### Testing Strategy
- Unit tests for all modules with mocked platform commands
- Integration tests that verify actual process termination
- Platform-specific test files that validate command construction
- 100% code coverage requirement enforced in Jest config