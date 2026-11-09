## 2025-05-24 - [Defense-in-depth Protocol Validation]
**Vulnerability:** Arbitrary protocol parameters passed directly to shell commands via process-finder platforms (e.g., linux.ts, macos.ts) which lacked runtime validation. Even though top-level classes performed validation, the lower-level methods directly injected strings like protocol into lsof/netstat arguments.
**Learning:** External inputs must be validated or normalized immediately before being passed to potentially dangerous operations like shell command argument interpolation, rather than relying exclusively on higher architectural layers.
**Prevention:** Always apply validation (`normalizeProtocol`) at the lowest platform architectural layer (linux.ts, macos.ts, windows.ts) that performs the potentially unsafe operation.
