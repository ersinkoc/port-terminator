# Comprehensive TypeScript Security Audit Report

**Project**: @oxog/port-terminator v1.0.0
**Date**: 2026-03-06
**Auditor**: Claude Code (Automated Security & Quality Audit)

---

## Executive Summary

The `port-terminator` codebase is a cross-platform Node.js utility for terminating processes on network ports. The project follows sound architectural principles (zero runtime dependencies, platform abstraction, strict TypeScript config). However, this audit uncovered **47 issues** across security, type safety, configuration, code quality, and testing dimensions.

The most critical findings are: (1) the TypeScript configuration is fundamentally broken for `npm run typecheck`, producing 60+ type errors; (2) the ESLint configuration is incompatible with the installed ESLint v10, meaning zero linting is enforced; (3) significant code duplication across platform modules (~200 lines duplicated 3x); (4) multiple `npm audit` vulnerabilities in devDependencies; and (5) test coverage (48%) falls well below the configured 60% threshold, which would fail CI.

From a security perspective, the codebase properly uses `child_process.spawn` with argument arrays (preventing shell injection) and validates port numbers before use. The primary security concern is the lack of runtime validation on the `protocol/method` parameter, which flows from user input to shell command arguments.

**Risk Assessment**: MEDIUM — No critical runtime security vulnerabilities, but the broken toolchain (typecheck, lint, coverage) means regressions can silently enter the codebase.

---

## Metrics Summary

| Metric | Score | Notes |
|--------|-------|-------|
| **Total Issues** | **47** | 5 Critical, 10 High, 18 Medium, 14 Low |
| **Code Health** | **5/10** | Good architecture, but broken toolchain and significant duplication |
| **Security** | **7/10** | spawn() prevents injection; protocol validation gap; no secrets exposure |
| **Maintainability** | **4/10** | Heavy duplication, broken lint/typecheck, low test coverage |

---

## 1. CRITICAL Issues (Fix Immediately)

### [CRITICAL-001] TypeScript Configuration — Missing Node.js Types

**Category**: Configuration / Type System
**File**: `tsconfig.json`
**Impact**: `npm run typecheck` produces 60+ errors. The entire type checking pipeline is non-functional.

**Problem**: The `tsconfig.json` sets `"lib": ["ES2020"]` but does not include `"node"` in `types`. Node.js globals (`process`, `setTimeout`, `clearTimeout`, `require`, `module`, `console`, `Buffer`, `NodeJS` namespace) are all unresolved. The `@types/node` package is installed as a devDependency but the compiler doesn't know to use it.

**Current Code** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "lib": ["ES2020"]
    // no "types" field
  }
}
```

**Recommendation**:
```json
{
  "compilerOptions": {
    "lib": ["ES2020"],
    "types": ["node"]
  }
}
```

---

### [CRITICAL-002] ESLint Configuration Incompatible with Installed Version

**Category**: Configuration / Code Quality
**File**: `.eslintrc.json`, `package.json`
**Impact**: `npm run lint` fails completely. Zero linting is enforced.

**Problem**: `package.json` specifies `"eslint": "^8.50.0"` but npm resolved ESLint **v10.0.0** (which requires the new flat config format `eslint.config.js`). The `.eslintrc.json` configuration file is ignored by ESLint v9+.

**Output**:
```
ESLint: 10.0.0
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

**Recommendation**: Either pin ESLint to `"eslint": "~8.57.0"` or migrate to the flat config format. Pinning is the faster fix:
```json
"eslint": "~8.57.0"
```

---

### [CRITICAL-003] Test Coverage Below Configured Threshold

**Category**: Testing
**File**: `jest.config.js`
**Impact**: CI would fail. Configured threshold is 60% but actual coverage is 48%.

**Details**:
| Metric | Threshold | Actual |
|--------|-----------|--------|
| Statements | 60% | 48.09% |
| Branches | 60% | 49.48% |
| Functions | 60% | 44.82% |
| Lines | 60% | 48.59% |

**Worst covered areas**:
- `src/cli/index.ts`: 0% (no test coverage at all)
- `src/platforms/linux.ts`: 2.08%
- `src/platforms/windows.ts`: 1.98%
- `src/core/process-finder.ts`: 44.23%

**Recommendation**: Either lower thresholds to match reality or add tests for CLI and platform modules.

---

### [CRITICAL-004] npm Audit — High Severity Vulnerabilities in Dependencies

**Category**: Dependency Security
**Impact**: Build toolchain dependencies have known vulnerabilities.

**High Severity**:
- `glob 10.2.0-10.4.5`: Command injection via `-c/--cmd` (GHSA-5j98-mcp5-4vw2) — in `rimraf`
- `minimatch <=3.1.3`: Multiple ReDoS vulnerabilities (GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) — in eslint, typescript-estree, glob, test-exclude

**Moderate Severity**:
- `ajv <6.14.0`: ReDoS with `$data` option (GHSA-2g4f-4pwh-qvx6)
- `js-yaml <3.14.2 || >=4.0.0 <4.1.1`: Prototype pollution in merge (GHSA-mh29-5h37-fv8m)

**Recommendation**: Run `npm audit fix` and update pinned dependency versions.

---

### [CRITICAL-005] CLI Module — Implicit `any` Types

**Category**: Type System
**File**: `src/cli/index.ts:277, 284`
**Impact**: Bypasses the strict TypeScript configuration. Could mask runtime errors.

**Current Code**:
```typescript
// Line 277
process.on('unhandledRejection', (reason) => {  // reason is implicitly 'any'

// Line 284
process.on('uncaughtException', (error) => {     // error is implicitly 'any'
```

**Recommendation**:
```typescript
process.on('unhandledRejection', (reason: unknown) => {
  const logger = new Logger();
  logger.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  const logger = new Logger();
  logger.error('Uncaught exception:', error.message);
  process.exit(1);
});
```

---

## 2. HIGH Issues (Fix This Sprint)

### [HIGH-001] Massive Code Duplication — `executeCommand` Duplicated 3x

**Category**: Code Quality / Maintainability
**Files**: `src/platforms/linux.ts:180-251`, `src/platforms/macos.ts:105-176`, `src/platforms/windows.ts:116-188`
**Impact**: ~75 lines of identical code duplicated 3 times. Bug fixes must be applied in 3 places (as evidenced by BUG-2025-004 fix comments appearing in all 3 files).

**Problem**: The `executeCommand` method (spawn a child process with timeout, collect stdout/stderr, handle errors) is copy-pasted across all 3 platform implementations with only `windowsHide: true` differing in the Windows version.

**Recommendation**: Extract to a shared utility:
```typescript
// src/utils/execute-command.ts
export function executeCommand(command: string, args: string[], options?: { timeoutMs?: number; windowsHide?: boolean }): Promise<ICommandResult>
```

**Also duplicated**:
- `deduplicateProcesses` (~10 lines, duplicated in all 3 platform files)
- `waitForProcessToExit` (~10 lines, duplicated in linux.ts and macos.ts)
- Platform selection switch statement (duplicated in `ProcessFinder` and `ProcessKiller`)

---

### [HIGH-002] Silent Error Swallowing in Multiple Locations

**Category**: Error Handling
**Files**: Multiple
**Impact**: Failures are silently masked, making debugging extremely difficult.

**Locations**:
| File | Line | Context |
|------|------|---------|
| `src/core/process-finder.ts` | 42-44 | `findByPorts` — errors become empty arrays |
| `src/core/process-killer.ts` | 42-44 | `killProcess` graceful attempt — error silently caught |
| `src/core/process-killer.ts` | 62-64 | `killProcesses` — failed kills silently return false |
| `src/core/process-killer.ts` | 92-94 | `killProcessesByPort` — errors silently skip processes |
| `src/platforms/linux.ts` | 102-104 | Per-protocol lsof errors silently ignored |
| `src/platforms/linux.ts` | 175-177 | Entire netstat fallback swallowed |

**Recommendation**: At minimum, add debug-level logging in catch blocks so failures can be diagnosed:
```typescript
} catch (error) {
  this.logger?.debug(`Failed to find processes on port ${port}: ${error}`);
  results.set(port, []);
}
```

---

### [HIGH-003] No Runtime Validation of `protocol`/`method` Parameter

**Category**: Security / Input Validation
**Files**: `src/index.ts:41`, `src/platforms/linux.ts:64`, `src/platforms/macos.ts:10`
**Impact**: Arbitrary strings could be passed as protocol and used in shell command construction.

**Problem**: The `method` option is typed as `'tcp' | 'udp' | 'both'` but this is only enforced at compile-time. At runtime, any string can be passed through the JavaScript API:
```typescript
const terminator = new PortTerminator({ method: 'malicious-string' as any });
```
This string flows directly to `lsof -i ${proto}:${port}`. While `spawn` with args array prevents shell injection, the string becomes a literal argument to `lsof`.

**Recommendation**: Add runtime validation in the `PortTerminator` constructor:
```typescript
this.options = {
  method: normalizeProtocol(options.method),  // Already exists in validators.ts but not used here
  // ...
};
```

---

### [HIGH-004] `PortTerminatorError.code` Uses `string` Instead of `ErrorCode` Enum

**Category**: Type System
**File**: `src/errors/index.ts:12`
**Impact**: Consumers cannot use exhaustive switch checks on error codes.

**Current Code**:
```typescript
public readonly code: string;
```

**Recommendation**:
```typescript
public readonly code: ErrorCode;
```

---

### [HIGH-005] Missing `noUncheckedIndexedAccess` in tsconfig

**Category**: Type System / Configuration
**File**: `tsconfig.json`
**Impact**: Array indexing silently returns `T` instead of `T | undefined`, masking potential out-of-bounds access.

**Affected locations**:
- `src/platforms/windows.ts:203`: `parts[0]` access after CSV parsing
- `src/platforms/windows.ts:259`: `parts[6]` access
- `src/platforms/linux.ts:84`: Destructuring `parts` array
- `src/platforms/macos.ts:29`: Destructuring `parts` array
- All `split('\n')` followed by array indexing

**Recommendation**: Add `"noUncheckedIndexedAccess": true` to `tsconfig.json` and handle `undefined` at each index access.

---

### [HIGH-006] Timeout Option Not Used as Overall Operation Timeout

**Category**: Design / Correctness
**File**: `src/index.ts:42, 99-137`
**Impact**: The `timeout` option in `IPortTerminatorOptions` is documented but never enforced for `terminate()` or `terminateMultiple()`. Operations can hang indefinitely.

**Problem**: The `timeout` is only used in `waitForPort()`. The `terminate()` and `terminateMultiple()` methods call `processFinder.findByPort()` and `processKiller.killProcessesByPort()` without any timeout wrapper.

**Recommendation**: Wrap the main operations with `Promise.race` against a timeout:
```typescript
async terminate(port: number | number[]): Promise<boolean> {
  return Promise.race([
    this._doTerminate(port),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError('terminate', this.options.timeout)), this.options.timeout)
    )
  ]);
}
```

---

### [HIGH-007] `require` Used in ES Module Context

**Category**: Code Quality / Compatibility
**File**: `src/cli/index.ts:11`
**Impact**: Will fail in ESM builds. The `require` call returns `any` type, bypassing TypeScript's type checking.

**Current Code**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json');
```

**Recommendation**: Use a typed constant or read version from a generated file:
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };
```

Or define a version constant:
```typescript
const VERSION = '1.0.0';  // Update via build script
```

---

### [HIGH-008] Unused Exported Functions and Classes

**Category**: Dead Code
**Files**: Multiple
**Impact**: Increases API surface, bundle size, and maintenance burden.

**Unused exports** (never called within the codebase):
| Export | File | Status |
|--------|------|--------|
| `ProcessFinder.findByPorts()` | `src/core/process-finder.ts:33` | Never called |
| `ProcessFinder.waitForPortToBeBusy()` | `src/core/process-finder.ts:86` | Never called |
| `ProcessKiller.killProcessesByPorts()` | `src/core/process-killer.ts:100` | Never called |
| `PortScanner` class (entire) | `src/core/port-scanner.ts` | Exported from index.ts, never used internally |
| `isUnix()` | `src/utils/platform.ts:31` | Never called |
| `getShell()` | `src/utils/platform.ts:35` | Never called |
| `getShellFlag()` | `src/utils/platform.ts:42` | Never called |
| `isValidProtocol()` | `src/utils/validators.ts:80` | Only used by `normalizeProtocol` (which is also barely used) |

---

### [HIGH-009] Tests Configuration Disables Strict Checking

**Category**: Testing / Type Safety
**File**: `tests/tsconfig.json`
**Impact**: Test code can have type errors that go undetected.

**Current Code**:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

**Problem**: By disabling `strict` and `noImplicitAny`, test code can use `any` types freely, mock functions without proper typing, and have undetected type errors. This undermines the strict source configuration.

**Recommendation**: Keep `strict: true` in test config and use proper mock typing with `jest.Mock<ReturnType, Args>` patterns.

---

### [HIGH-010] `options.force || false` Treats Explicit `false` Correctly but `options.method || 'both'` Does Not Handle Empty String

**Category**: Type System / Logic
**File**: `src/index.ts:41`
**Impact**: If someone passes `method: ''`, it would fall through to `'both'` rather than throwing an error.

**Current Code**:
```typescript
method: options.method || 'both',
```

**Recommendation**:
```typescript
method: options.method !== undefined ? normalizeProtocol(options.method) : 'both',
```

---

## 3. MEDIUM Issues (Fix Soon)

### [MEDIUM-001] No Abort/Cancellation Support

**Category**: Async/Concurrency
**Files**: `src/core/process-finder.ts`, `src/core/process-killer.ts`
**Impact**: Long-running operations cannot be cancelled by the caller.

**Problem**: `waitForPortToBeAvailable` and `waitForPortToBeBusy` use polling loops with no way to signal cancellation. The `executeCommand` methods set up timeouts but don't accept `AbortSignal`.

---

### [MEDIUM-002] `Error.captureStackTrace` Not Available in All Environments

**Category**: Compatibility
**File**: `src/errors/index.ts:22`
**Impact**: Will throw in non-V8 environments (e.g., Firefox SpiderMonkey, if this code ever runs in a bundled context).

**Current Code**:
```typescript
Error.captureStackTrace(this, this.constructor);
```

**Recommendation**: Guard with a check:
```typescript
if (Error.captureStackTrace) {
  Error.captureStackTrace(this, this.constructor);
}
```

---

### [MEDIUM-003] `WindowsPlatform.waitForProcessToExit` Never Actually Detects Exit

**Category**: Logic Bug
**File**: `src/platforms/windows.ts:270-280`
**Impact**: On Windows, the graceful shutdown timeout loops forever checking `tasklist` but `tasklist` returns exit code 0 even when a process doesn't exist (it just outputs "INFO: No tasks are running..."). The catch block would only trigger on command execution failure, not on "process not found" output.

**Current Code**:
```typescript
private async waitForProcessToExit(pid: number, timeout: number): Promise<void> {
  while (Date.now() - startTime < timeout) {
    try {
      await this.executeCommand('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV']);
      // tasklist succeeds even when PID doesn't exist
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      return;  // Only catches command execution failures
    }
  }
}
```

**Recommendation**: Check the output of `tasklist` for "INFO: No tasks" or check if the PID appears in the output:
```typescript
const result = await this.executeCommand('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
if (!result.stdout.includes(pid.toString())) {
  return; // Process has exited
}
```

---

### [MEDIUM-004] `WindowsPlatform.isProcessRunning` Has Same Issue

**Category**: Logic Bug
**File**: `src/platforms/windows.ts:97-114`
**Impact**: May return `true` even when process doesn't exist, if `tasklist` returns "INFO: No tasks" message.

**Current Code**:
```typescript
const lines = result.stdout.trim().split('\n');
return lines.length > 0 && lines[0].trim().length > 0;
```

**Problem**: If no process matches the filter, `tasklist` outputs `"INFO: No tasks are running which match the specified criteria."` which is a non-empty line, causing this to return `true`.

**Recommendation**:
```typescript
return lines.length > 0 && !result.stdout.includes('INFO: No tasks');
```

---

### [MEDIUM-005] Potential Memory Issue with Large Port Range Scans

**Category**: Performance
**File**: `src/core/port-scanner.ts:62-67`
**Impact**: `scanPortRange` creates an array of all port numbers before scanning.

For a range of 1-65535, this creates an array of 65,535 elements and then launches that many concurrent `findByPort` calls via `scanPorts` → `Promise.all`.

**Recommendation**: Add concurrency limiting (e.g., process in batches of 50) or use the existing `maxRangeSize` validation.

---

### [MEDIUM-006] Logger `formatMessage` Doesn't Append Unused Args

**Category**: Code Quality
**File**: `src/utils/logger.ts:89-122`
**Impact**: If more args are passed than format placeholders, the extra args are silently dropped.

```typescript
logger.error('Something failed', errorObject, additionalContext);
// Only 'Something failed' is printed, errorObject and additionalContext are lost
```

**Recommendation**: Append remaining args after format string replacement, similar to Node's `util.format`.

---

### [MEDIUM-007] `process.exit()` Called in Multiple Places Without Cleanup

**Category**: Code Quality
**File**: `src/cli/index.ts:50, 66, 73, 280, 287, 294`
**Impact**: `process.exit()` terminates immediately without allowing event loop to drain. Could lose buffered log output despite the `setImmediate` mitigation.

---

### [MEDIUM-008] Duplicate Platform Instantiation

**Category**: Performance / Design
**Files**: `src/core/process-finder.ts`, `src/core/process-killer.ts`
**Impact**: Each `ProcessFinder` and `ProcessKiller` creates its own platform instance. When `PortTerminator` creates both, two identical platform objects exist. `ProcessKiller.killProcessesByPort` also calls `findProcessesByPort` independently.

**Recommendation**: Use dependency injection to share a single platform instance:
```typescript
class ProcessFinder {
  constructor(private platform: IPlatformImplementation) {}
}
```

---

### [MEDIUM-009] Inconsistent `protocol` Parameter Naming

**Category**: Code Quality
**Files**: Multiple
**Impact**: The same concept is called `method` in options, `protocol` in function parameters, and `proto` in local variables. This makes code harder to follow.

- `IPortTerminatorOptions.method`: `'tcp' | 'udp' | 'both'`
- `findProcessesByPort(port, protocol)`: `string`
- `findWithLsof(port, protocol)`: `string`
- Local: `proto`, `protoName`, `expectedProto`

---

### [MEDIUM-010] `parseCSVLine` Doesn't Handle Escaped Quotes

**Category**: Edge Case / Correctness
**File**: `src/platforms/windows.ts:283-305`
**Impact**: CSV fields containing escaped quotes (`""`) won't be parsed correctly.

---

### [MEDIUM-011] No Graceful Degradation When `lsof` Not Installed (Linux)

**Category**: Error Handling
**File**: `src/platforms/linux.ts:9-14`
**Impact**: On Linux, if `lsof` fails, `findWithNetstat` is used as fallback. But if `netstat` also isn't available (common on minimal Docker images), an empty array is returned with no indication of failure.

---

### [MEDIUM-012] `PortScanner.scanPorts` Has No Concurrency Limit

**Category**: Performance
**File**: `src/core/port-scanner.ts:43-48`
**Impact**: `Promise.all` on hundreds of ports launches all subprocess commands simultaneously, potentially exhausting system resources.

---

### [MEDIUM-013] Race Condition in `terminateMultiple` — Process on Multiple Ports

**Category**: Concurrency
**File**: `src/index.ts:99-137`
**Impact**: If the same process listens on multiple ports, concurrent termination attempts for different ports could try to kill the same PID simultaneously, leading to confusing error messages.

---

### [MEDIUM-014] `validateTimeout` Accepts `NaN`

**Category**: Input Validation
**File**: `src/utils/validators.ts:37`
**Impact**: `NaN < 0` is `false` and `isFinite(NaN)` is `false`, so `NaN` would be caught by `!isFinite`. However, `validateTimeout` accepts `0` and non-integer positive values like `0.5`, which may cause unexpected timeout behavior.

---

### [MEDIUM-015] Missing `readonly` on Interface Properties

**Category**: Type System
**Files**: `src/types/index.ts`
**Impact**: `IProcessInfo` properties (especially `pid`, `port`, `protocol`) should be readonly to prevent accidental mutation.

---

### [MEDIUM-016] `net` Module Not Used for Port Availability

**Category**: Design
**Files**: `src/platforms/linux.ts:46-49`, `src/platforms/macos.ts:89-92`
**Impact**: `isPortAvailable` runs `findProcessesByPort` which spawns external commands (lsof/netstat). A much faster approach for TCP would be to use Node's built-in `net.createServer().listen()` to test port availability directly.

---

### [MEDIUM-017] No Integration Tests for CLI

**Category**: Testing
**File**: `tests/unit/cli/cli-direct-execution.test.ts` exists but `cli-execution.test.skip` is skipped
**Impact**: The CLI module has 0% code coverage.

---

### [MEDIUM-018] 7 Skipped Test Suites

**Category**: Testing
**Impact**: 285 tests are skipped out of 657 total (43% skip rate). 7 entire suites are skipped.

---

## 4. LOW Issues (Tech Debt)

### [LOW-001] `ICliResult.data` Typed as `unknown`

**Category**: Type System
**File**: `src/cli/index.ts:17`
**Impact**: Minor — internal type. Could use discriminated unions for better type safety.

---

### [LOW-002] Magic Numbers

**Category**: Code Quality
**Files**: Multiple
**Instances**:
- `250` (check interval in `waitForPortToBeAvailable`) — `src/core/process-finder.ts:60`
- `100` (check interval in `waitForProcessToExit`) — `src/core/process-killer.ts:130`
- `30000` (default timeout) — appears in 5+ locations
- `5000` (graceful timeout) — appears in 4+ locations
- `65535` (max port) — `src/core/port-scanner.ts:96`
- `1000` (maxRangeSize default) — `src/utils/validators.ts:43`

---

### [LOW-003] `skipLibCheck: true` in tsconfig

**Category**: Configuration
**File**: `tsconfig.json`
**Impact**: Could hide type errors in `node_modules` type definitions. Generally acceptable but worth noting.

---

### [LOW-004] No `exactOptionalPropertyTypes` in tsconfig

**Category**: Configuration
**File**: `tsconfig.json`
**Impact**: Optional properties can be explicitly set to `undefined`, which may not match the intent.

---

### [LOW-005] Console Output in Library Code

**Category**: Code Quality
**File**: `src/utils/logger.ts:83-85`
**Impact**: The Logger uses `console.error` and `console.log` directly. Library consumers may want to redirect output.

---

### [LOW-006] `Error.captureStackTrace` Typing

**Category**: Type System
**File**: `src/errors/index.ts:22`
**Impact**: TypeScript doesn't have `captureStackTrace` in `ErrorConstructor` type (it's V8-specific). This causes a type error when strict checking is properly enabled.

---

### [LOW-007] Inconsistent Error Message Formats

**Category**: Code Quality
**Files**: `src/errors/index.ts`, `src/utils/validators.ts`
**Impact**: Some errors include port number, some don't. Some use template literals, some use concatenation. No consistent error code mapping for validators.

---

### [LOW-008] `ICommandResult.exitCode` Should Be `number | null`

**Category**: Type System
**File**: `src/types/index.ts:28`
**Impact**: The `close` event passes `code: number | null` but the interface expects `number`. The `code || 1` fallback in `executeCommand` handles this but it's a type mismatch.

---

### [LOW-009] `package.json` `engines.node` Set to `>=14.0.0`

**Category**: Configuration
**Impact**: ES2020 target is compatible with Node 14, but some features used (like `Promise.allSettled` if ever used, optional chaining in source) require Node 14+. The `spawn` API and `child_process` module are stable. However, Node 14 is EOL. Consider updating to `>=18.0.0`.

---

### [LOW-010] No `.nvmrc` or `.node-version` File

**Category**: Configuration
**Impact**: Contributors may use incompatible Node versions.

---

### [LOW-011] Build Scripts Use `cpr` and `rimraf` as DevDependencies

**Category**: Dependencies
**Impact**: Could use Node.js built-in `fs.cp` (Node 16+) and `fs.rm` (Node 14+) to eliminate 2 devDependencies.

---

### [LOW-012] Benchmark File Not TypeScript

**Category**: Code Quality
**File**: `benchmarks/performance.js`
**Impact**: Minor — benchmark is plain JS, not covered by TypeScript checking.

---

### [LOW-013] Multiple Bug Report Files in Repository Root

**Category**: Repository Hygiene
**Files**: `COMPREHENSIVE_BUG_REPORT.md`, `FINAL_BUG_FIX_SUMMARY.md`, `FINAL_COMPREHENSIVE_BUG_FIX_SUMMARY.md`, `NEW_BUG_ANALYSIS_REPORT.md`
**Impact**: Clutters the repository. Should be in a `docs/` folder or removed after issues are resolved.

---

### [LOW-014] `defaultLogger` Singleton Export

**Category**: Code Quality
**File**: `src/utils/logger.ts:130`
**Impact**: Module-level singleton is mutable. Any consumer calling `defaultLogger.setLevel()` or `defaultLogger.setSilent()` affects all other consumers.

---

## 5. Top 10 Critical Issues (Prioritized)

1. **[CRITICAL-001]** TypeScript `types: ["node"]` missing — typecheck completely broken
2. **[CRITICAL-002]** ESLint v10 incompatible with `.eslintrc.json` — linting completely broken
3. **[CRITICAL-003]** Test coverage 48% < 60% threshold — CI would fail
4. **[CRITICAL-005]** Implicit `any` types in CLI event handlers
5. **[HIGH-001]** ~200 lines of code duplicated 3x across platform modules
6. **[HIGH-002]** Silent error swallowing in 6+ locations
7. **[HIGH-003]** No runtime validation of `protocol`/`method` parameter
8. **[HIGH-006]** `timeout` option documented but not enforced on main operations
9. **[MEDIUM-003]** Windows `waitForProcessToExit` never detects exit
10. **[MEDIUM-004]** Windows `isProcessRunning` returns true for non-existent processes

---

## 6. Recommended Action Plan

### Phase 1: Fix Toolchain (Immediate)
- Add `"types": ["node"]` to `tsconfig.json`
- Pin ESLint to `~8.57.0` or migrate to flat config
- Run `npm audit fix`
- Fix implicit `any` types in `src/cli/index.ts`

### Phase 2: Fix Correctness Bugs (This Sprint)
- Fix Windows `isProcessRunning` and `waitForProcessToExit`
- Add runtime protocol validation
- Type `PortTerminatorError.code` as `ErrorCode`
- Guard `Error.captureStackTrace`

### Phase 3: Reduce Technical Debt (Next Sprint)
- Extract `executeCommand` to shared utility
- Extract platform selection to factory
- Add debug logging to catch blocks
- Implement `AbortSignal` support

### Phase 4: Improve Test Coverage (Ongoing)
- Add CLI integration tests
- Add platform-specific tests
- Enable skipped test suites
- Target 80% coverage

---

## 7. Files Changed in This Audit

The following fixes have been applied as part of this audit:

1. `tsconfig.json` — Added `"types": ["node"]`
2. `src/errors/index.ts` — Changed `code: string` to `code: ErrorCode`, guarded `captureStackTrace`
3. `src/cli/index.ts` — Fixed implicit `any` types
4. `src/index.ts` — Added runtime protocol validation
5. `src/platforms/windows.ts` — Fixed `isProcessRunning` and `waitForProcessToExit`
6. `src/utils/execute-command.ts` — Extracted shared `executeCommand` utility
7. `src/platforms/linux.ts` — Uses shared `executeCommand`
8. `src/platforms/macos.ts` — Uses shared `executeCommand`
