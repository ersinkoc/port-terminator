# New Bugs Found - port-terminator
## Date: 2025-11-06

## Summary
Found **3 verifiable bugs** through systematic code analysis.

---

## Bug #1: Falsy Timeout Value Handling in waitForPort

**Location:** `src/index.ts:201`

**Description:**
The `waitForPort` method uses falsy check (`timeout ?`) instead of explicit undefined check. This causes timeout=0 to be replaced with the default timeout value instead of being honored.

**Code:**
```typescript
const timeoutMs = timeout ? validateTimeout(timeout) : this.options.timeout;
```

**Impact:**
- Users cannot specify timeout=0 for immediate check behavior
- Timeout value of 0 is valid and explicitly handled in waitForPortToBeAvailable (lines 69-72 of process-finder.ts)
- Expected behavior: timeout=0 should check once and return immediately
- Actual behavior: timeout=0 is replaced with default timeout (30000ms)

**Reproduction:**
```typescript
const terminator = new PortTerminator({ timeout: 30000 });
// User explicitly wants immediate check with timeout=0
await terminator.waitForPort(3000, 0);
// BUG: Uses 30000ms instead of 0ms
```

**Expected Behavior:**
Should use explicit undefined check: `timeout !== undefined ? validateTimeout(timeout) : this.options.timeout`

**Proposed Fix:**
```typescript
const timeoutMs = timeout !== undefined ? validateTimeout(timeout) : this.options.timeout;
```

---

## Bug #2: Falsy Option Values in Constructor

**Location:** `src/index.ts:42, 45`

**Description:**
The constructor uses `||` operator to provide defaults, which treats 0 as falsy. This prevents users from setting timeout=0 or gracefulTimeout=0.

**Code:**
```typescript
this.options = {
  method: options.method || 'both',
  timeout: options.timeout || 30000,  // Bug: 0 is falsy
  force: options.force || false,
  silent: options.silent || false,
  gracefulTimeout: options.gracefulTimeout || 5000,  // Bug: 0 is falsy
};
```

**Impact:**
- Users cannot set timeout=0 (would use 30000 instead)
- Users cannot set gracefulTimeout=0 (would use 5000 instead)
- Timeout value of 0 is valid and has defined behavior
- GracefulTimeout of 0 would mean "skip graceful shutdown, force kill immediately"

**Reproduction:**
```typescript
const terminator = new PortTerminator({
  timeout: 0,           // BUG: Becomes 30000
  gracefulTimeout: 0    // BUG: Becomes 5000
});
```

**Expected Behavior:**
Should use nullish coalescing or explicit undefined check:
```typescript
timeout: options.timeout ?? 30000,
gracefulTimeout: options.gracefulTimeout ?? 5000,
```

**Proposed Fix:**
```typescript
this.options = {
  method: options.method || 'both',  // OK for strings
  timeout: options.timeout !== undefined ? options.timeout : 30000,
  force: options.force || false,     // OK for booleans
  silent: options.silent || false,   // OK for booleans
  gracefulTimeout: options.gracefulTimeout !== undefined ? options.gracefulTimeout : 5000,
};
```

---

## Bug #3: macOS Fallback Missing UDP When Protocol is 'both'

**Location:** `src/platforms/macos.ts:173`

**Description:**
The `fallbackFindProcesses` method only checks TCP when protocol is 'both', completely missing UDP processes. This is inconsistent with the main lsof implementation which correctly iterates over both protocols.

**Code:**
```typescript
const netstatResult = await this.executeCommand('netstat', [
  '-an',
  '-p',
  protocol === 'both' ? 'tcp' : protocol,  // Bug: Only checks TCP for 'both'
]);
```

**Impact:**
- UDP processes are not detected when lsof is unavailable and protocol='both'
- Inconsistent behavior between lsof and netstat fallback
- Users would get incomplete results on macOS systems without lsof
- Main lsof code correctly handles this (lines 10-47)

**Comparison with Linux:**
Linux's netstat fallback correctly handles 'both' by using `-tulpn` flag which includes both TCP and UDP.

**Comparison with Main Implementation:**
The main macOS implementation (lines 10-47) correctly handles 'both':
```typescript
const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];
for (const proto of protocols) {
  // Check each protocol
}
```

**Reproduction:**
```typescript
// On macOS without lsof installed
const platform = new MacOSPlatform();
// Start a UDP server on port 3000
const processes = await platform.findProcessesByPort(3000, 'both');
// BUG: UDP process not found because fallback only checks TCP
```

**Expected Behavior:**
Should check both TCP and UDP when protocol is 'both', similar to the main implementation.

**Proposed Fix:**
```typescript
private async fallbackFindProcesses(port: number, protocol: string): Promise<IProcessInfo[]> {
  const protocols = protocol === 'both' ? ['tcp', 'udp'] : [protocol];

  for (const proto of protocols) {
    try {
      const netstatResult = await this.executeCommand('netstat', [
        '-an',
        '-p',
        proto,
      ]);
      // ... rest of parsing logic ...
      // If port found, throw error (can't determine PID)
    } catch (error) {
      // Handle errors
    }
  }

  return [];
}
```

---

## Verification Plan

For each bug:
1. ✅ Write a failing test that demonstrates the bug
2. ✅ Apply the minimal fix
3. ✅ Verify the test passes
4. ✅ Run full test suite to ensure no regressions

## Priority

- **Bug #1:** High - Prevents using valid timeout value (0)
- **Bug #2:** High - Prevents using valid option values (0)
- **Bug #3:** Medium - Only affects macOS systems without lsof, which is rare

## Statistics

### Bugs by Type
- **Logic Errors (Falsy vs Undefined):** 2
- **Missing Protocol Handling:** 1

### Bugs by Severity
- **High:** 2 (Bugs #1, #2 - Prevent valid user input)
- **Medium:** 1 (Bug #3 - Affects rare configuration)

### Files Affected
- `src/index.ts` - 2 bugs
- `src/platforms/macos.ts` - 1 bug
