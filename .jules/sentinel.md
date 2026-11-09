
## 2026-03-31 - [CWE-400] Uncontrolled Resource Consumption in `executeCommand`
**Vulnerability:** The `executeCommand` utility spawned child processes and appended their `stdout` and `stderr` directly into unbounded strings. A malicious or unexpectedly verbose process could cause Node.js memory exhaustion and crash the application.
**Learning:** Utilities that spawn subprocesses must proactively enforce `maxBuffer` limits since standard child_process.spawn streams are unbounded by default (unlike `child_process.exec`).
**Prevention:** Implement `maxBuffer` checks on stream `data` events, and terminate the process with `SIGKILL` if the limit is exceeded.
