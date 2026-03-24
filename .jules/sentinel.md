## 2026-03-06 - [Defense in Depth] Input validation in exported core classes
**Vulnerability:** Core classes like `ProcessFinder` and `PortScanner` accepted unvalidated `protocol` parameters which could lead to argument injection if used directly, even though the facade class (`PortTerminator`) validated it.
**Learning:** Exported core classes must perform their own input validation (defense in depth) to protect against unexpected usage patterns bypassing facade validation.
**Prevention:** Always apply input validation (`normalizeProtocol` in this case) at the lowest public architectural layer possible, ensuring all entry points to shell commands are sanitized.
