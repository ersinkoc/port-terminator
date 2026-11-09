## 2026-03-06 - [Operational Security: Masked Security Errors via Empty Catch Blocks]
**Vulnerability:** Empty catch blocks in core operations (`process-finder.ts`, `process-killer.ts`) were swallowing error logs silently.
**Learning:** Error swallowing inherently masks critical security issues (e.g. `Permission denied`, `No such file`). In a security context, developers need full visibility into why security-oriented tools fail, ensuring that debugging failures isn't impossible.
**Prevention:** Avoid writing empty `} catch {` blocks without at least logging the error to a configured `Logger`. Operational transparency is vital for defensive coding.
