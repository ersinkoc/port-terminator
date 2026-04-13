
## 2025-05-18 - [HIGH] Fix DoS vulnerability via unbounded stdout/stderr in executeCommand
**Vulnerability:** The `executeCommand` utility spawned child processes using `child_process.spawn` without restricting the maximum size of standard output/error buffers. This allowed malicious or misbehaving commands to consume unlimited memory, creating a Denial of Service (DoS) vulnerability via memory exhaustion.
**Learning:** `child_process.spawn` stream event handlers do not limit buffer size inherently (unlike `child_process.exec` which has a `maxBuffer` parameter built-in). Explicit buffer size tracking and enforcing is needed in custom `spawn` wrappers.
**Prevention:** Implement buffer size tracking in `stdout.on('data')` and `stderr.on('data')` handlers, compare against a configured `maxBuffer` limit, and proactively terminate the child process if the limit is exceeded.
