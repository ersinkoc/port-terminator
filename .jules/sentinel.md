## 2025-05-24 - [Uncontrolled Resource Consumption] DoS via executeCommand
**Vulnerability:** The `executeCommand` utility (using `child_process.spawn`) buffered `stdout` and `stderr` output indefinitely without size restrictions, leading to Uncontrolled Resource Consumption (CWE-400 / OOM DoS).
**Learning:** Unlike `child_process.exec`, streams from `spawn` do not natively limit the size of buffered data. It must be manually restricted.
**Prevention:** Always implement a `maxBuffer` parameter (e.g., defaulting to 1MB) and strictly monitor the total length of accumulated data chunks across stream `data` events. Immediately `SIGKILL` the process if limits are exceeded to avoid memory exhaustion attacks.
