## 2024-03-26 - [Uncontrolled Resource Consumption]
**Vulnerability:** The `executeCommand` utility accumulated child process `stdout` and `stderr` indefinitely without a limit. If a command produced an extremely large amount of output, it could consume all available memory and crash the application (Denial of Service).
**Learning:** We must establish bounds on data we process from external/child processes to avoid resource exhaustion.
**Prevention:** Always use bounds/limits when buffering output (e.g., `maxBuffer`) and kill the process if the limit is exceeded.
