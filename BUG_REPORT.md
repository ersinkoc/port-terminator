# Bug Report - port-terminator

## Summary
Found 4 verifiable bugs in the codebase through systematic code analysis and test execution.

---

## Bug #1: Test Bug - Missing isProcessRunning Mock

**Location:** `tests/unit/process-killer.test.ts:280-330` (line 289-293, 325)

**Description:**
The test "should execute setTimeout and continue loop to cover line 126" mocks `findProcessesByPort` on the platform instance, but the actual `waitForProcessToExit` implementation calls `isProcessRunning` (not `findProcessesByPort`). This causes the test to fail because it expects a method that is never called.

**Impact:**
- Test suite fails with error: "Expected number of calls: 2, Received number of calls: 0"
- Reduces confidence in test coverage

**Reproduction:**
```bash
npx jest tests/unit/process-killer.test.ts --testNamePattern="should execute setTimeout"
```

**Expected Behavior:**
Test should mock the correct method (`isProcessRunning`) that the implementation actually calls.

**Proposed Fix:**
Add `isProcessRunning: jest.fn()` to the `testPlatformInstance` mock object and update the test to mock this method instead of `findProcessesByPort`.

---

## Bug #2: Inconsistent Logging - console.debug Usage

**Locations:**
- `src/core/process-finder.ts:44`
- `src/core/process-killer.ts:65`
- `src/core/process-killer.ts:98`
- `src/core/process-killer.ts:129`

**Description:**
The code uses `console.debug()` directly instead of using the Logger class. This bypasses all logger configuration including silent mode and log level settings. This is inconsistent with the rest of the codebase which uses the Logger abstraction.

**Impact:**
- Debug messages cannot be controlled via logger settings
- Silent mode doesn't suppress these debug messages
- Inconsistent logging approach across codebase
- Visible in test output as unwanted console.debug messages

**Reproduction:**
Run tests and observe console.debug output:
```
console.debug
    Failed to kill process 5678: Kill failed
      at src/core/process-killer.ts:65:21
```

**Expected Behavior:**
All logging should go through the Logger class to respect configuration.

**Proposed Fix:**
Remove the `console.debug` calls. These are in error-handling catch blocks where we're already setting error results, so additional logging is not necessary. If logging is desired, a Logger instance should be injected.

---

## Bug #3: Invalid Port Range in findAvailablePort

**Location:** `src/core/port-scanner.ts:87-102` (lines 92-93)

**Description:**
The `findAvailablePort` method calculates ports as `startPort + i` without validating that the result doesn't exceed the maximum valid port number (65535). This can result in attempts to scan invalid ports.

**Impact:**
- Attempts to check availability of invalid port numbers
- May cause unexpected behavior or errors from platform-specific commands
- Wastes time checking ports that can never be valid

**Reproduction:**
```typescript
const scanner = new PortScanner();
// This will try ports 65500, 65501, ..., up to 65599
// Ports 65536-65599 are invalid
await scanner.findAvailablePort(65500, 100);
```

**Expected Behavior:**
Should skip or stop checking when port number exceeds 65535.

**Proposed Fix:**
Add validation: `if (port > 65535) break;` or `if (port > 65535) continue;` in the loop.

---

## Bug #4: Invalid Port Range in findAvailablePorts

**Location:** `src/core/port-scanner.ts:104-127` (lines 112, 121)

**Description:**
Similar to Bug #3, the `findAvailablePorts` method increments `currentPort` without validating it doesn't exceed 65535. This can result in attempts to scan invalid ports.

**Impact:**
- Same as Bug #3
- May return fewer ports than requested if it runs out of valid ports to check

**Reproduction:**
```typescript
const scanner = new PortScanner();
// Starting from 65530, trying to find 10 available ports
// Will attempt to check ports > 65535
await scanner.findAvailablePorts(10, 65530);
```

**Expected Behavior:**
Should stop checking when port number exceeds 65535 and return whatever valid ports were found.

**Proposed Fix:**
Add validation: `if (currentPort > 65535) break;` in the while loop.

---

## Verification Plan

For each bug:
1. Write a failing test that demonstrates the bug
2. Apply the fix
3. Verify the test passes
4. Run full test suite to ensure no regressions

## Priority

- **Bug #1 (Test):** High - Actively failing test
- **Bug #2 (console.debug):** Medium - Code quality issue, inconsistent logging
- **Bug #3 (findAvailablePort):** High - Logic error with undefined behavior
- **Bug #4 (findAvailablePorts):** High - Logic error with undefined behavior
