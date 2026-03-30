## 2025-03-30 - Uncontrolled Resource Consumption via Unbounded Streams
**Vulnerability:** `executeCommand` aggregates `stdout` and `stderr` directly into memory strings without limits. A malicious or runaway process outputting huge amounts of data can cause the V8 engine to exhaust memory heap, leading to a Denial of Service (DoS) (CWE-400).
**Learning:** `child_process.spawn` stream events fire repeatedly with `Buffer` chunks. Aggregating them indiscriminately ignores resource constraints, making the host vulnerable to resource exhaustion.
**Prevention:** Always implement a `maxBuffer` ceiling (e.g., 1MB) on aggregated streams and terminate the subprocess immediately with `SIGKILL` if the threshold is exceeded.
