# Sentinel Journal

## 2026-03-06 - Initial setup
**Learning:** Sentinel journal created.

## 2026-03-06 - [CRITICAL] Prevent DoS via Uncontrolled Resource Consumption in executeCommand
**Vulnerability:** The `executeCommand` utility used `child_process.spawn` and accumulated the data from `stdout` and `stderr` streams directly into string variables without any limit. This created an uncontrolled resource consumption vulnerability (DoS) because a command outputting a massive amount of text could exhaust the Node.js process memory.
**Learning:** Unlike `child_process.exec` which has a built-in `maxBuffer` limit, `child_process.spawn`'s output streams must be manually limited to prevent memory exhaustion when concatenating chunks.
**Prevention:** Added a `maxBuffer` parameter (defaulting to 1MB) to `executeCommand` and implemented logic in the `data` event handlers to track the total size of accumulated data. If the size exceeds the limit, the child process is immediately killed with `SIGKILL` and an error is thrown, preventing memory exhaustion.
