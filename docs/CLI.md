# CLI Documentation

The `@oxog/port-terminator` package provides a powerful command-line interface for terminating processes running on specified ports.

## Installation

```bash
# Install globally for CLI usage
npm install -g @oxog/port-terminator
```

## Commands

The package provides two equivalent commands:
- `port-terminator` - Full command name
- `pt` - Short alias for convenience

## Basic Usage

### Single Port

Terminate process running on a specific port:

```bash
port-terminator 3000
pt 3000
```

### Multiple Ports

Terminate processes running on multiple ports:

```bash
port-terminator 3000 8080 9000
pt 3000 8080 9000
```

### Port Range

Terminate processes running on a range of ports:

```bash
port-terminator --range 3000-3005
port-terminator -r 3000-3005
pt -r 3000-3005
```

## Options

### `-r, --range <start-end>`

Kill processes in a port range.

```bash
port-terminator --range 3000-3005
port-terminator --range 8080-8090
```

### `-f, --force`

Force kill processes without attempting graceful shutdown first.

```bash
port-terminator 3000 --force
port-terminator 3000 -f
```

### `-t, --timeout <ms>`

Set overall operation timeout in milliseconds (default: 30000).

```bash
port-terminator 3000 --timeout 10000
port-terminator 3000 -t 5000
```

### `-g, --graceful-timeout <ms>`

Set graceful shutdown timeout in milliseconds (default: 5000).

```bash
port-terminator 3000 --graceful-timeout 2000
port-terminator 3000 -g 2000
```

### `-m, --method <protocol>`

Specify which protocol to target: `tcp`, `udp`, or `both` (default: both).

```bash
port-terminator 3000 --method tcp
port-terminator 3000 --method udp
port-terminator 3000 -m tcp
```

### `-n, --dry-run`

Show what would be killed without actually terminating processes.

```bash
port-terminator 3000 --dry-run
port-terminator 3000 -n
```

### `-j, --json`

Output results in JSON format for programmatic parsing.

```bash
port-terminator 3000 --json
port-terminator 3000 -j
```

### `-s, --silent`

Suppress all output except errors.

```bash
port-terminator 3000 --silent
port-terminator 3000 -s
```

### `-h, --help`

Show help message with all available options.

```bash
port-terminator --help
port-terminator -h
pt -h
```

### `-v, --version`

Show version number.

```bash
port-terminator --version
port-terminator -v
pt -v
```

## Examples

### Development Workflow

Clean up common development ports:

```bash
# Kill processes on common dev ports
pt 3000 3001 8080 8081 9000

# Clean up with force
pt 3000 8080 --force

# Clean up port range used by microservices
pt --range 3000-3010 --force
```

### CI/CD Pipeline

Use in scripts with JSON output:

```bash
#!/bin/bash

# Clean up test ports before running tests
RESULT=$(pt 3000 8080 --json --silent)
echo "Cleanup result: $RESULT"

# Start tests
npm test
```

### Docker Development

Clean up ports used by Docker containers:

```bash
# Kill processes and show what was terminated
pt 80 443 3000 8080 --dry-run

# Actually terminate if dry-run looks good
pt 80 443 3000 8080 --force
```

### Debug Mode

See detailed information about what's being terminated:

```bash
# Show detailed output
pt 3000

# Show only TCP processes
pt 3000 --method tcp

# Show what would be killed
pt 3000 --dry-run
```

## Output Formats

### Standard Output

Default human-readable output:

```bash
$ pt 3000
[2024-01-15T10:30:00.000Z] INFO  Found 1 process(es) on port 3000
[2024-01-15T10:30:00.100Z] INFO  Successfully terminated 1 process(es) on port 3000

Terminated processes:

Port 3000:
  - PID 1234: node (tcp)
```

### JSON Output

Structured output for programmatic use:

```bash
$ pt 3000 --json
{
  "results": [
    {
      "port": 3000,
      "success": true,
      "processes": [
        {
          "pid": 1234,
          "name": "node",
          "port": 3000,
          "protocol": "tcp",
          "command": "node server.js",
          "user": "developer"
        }
      ]
    }
  ],
  "summary": {
    "totalPorts": 1,
    "successfulPorts": 1,
    "totalProcessesKilled": 1
  }
}
```

### Dry Run Output

Preview mode shows what would be terminated:

```bash
$ pt 3000 --dry-run
Dry run: Would terminate 1 process(es) on 1 port(s)

Port 3000:
  - PID 1234: node (tcp)
    Command: node server.js
```

### Silent Mode

No output except errors:

```bash
$ pt 3000 --silent
# No output if successful

$ pt 3000 --silent
[2024-01-15T10:30:00.000Z] ERROR ProcessNotFoundError: No process found running on port 3000
```

## Exit Codes

The CLI returns different exit codes based on the operation result:

- `0` - Success: All operations completed successfully
- `1` - Error: One or more operations failed or an error occurred

## Error Handling

### Common Errors

#### Port Not Found
```bash
$ pt 9999
[2024-01-15T10:30:00.000Z] WARN  No processes found on port 9999
# Exit code: 0 (this is not considered an error)
```

#### Permission Denied
```bash
$ pt 80
[2024-01-15T10:30:00.000Z] ERROR PermissionError: Access denied when trying to kill process 1234
# Exit code: 1
```

#### Invalid Port
```bash
$ pt 70000
[2024-01-15T10:30:00.000Z] ERROR InvalidPortError: Invalid port number: 70000. Port must be between 1 and 65535
# Exit code: 1
```

#### Invalid Range
```bash
$ pt --range 3000-70000
[2024-01-15T10:30:00.000Z] ERROR InvalidPortError: Invalid port number: 70000. Port must be between 1 and 65535
# Exit code: 1
```

### Error Output Format

Errors are always sent to stderr and formatted consistently:

```bash
[timestamp] ERROR ErrorType: Error message
```

## Advanced Usage

### Combining Options

Multiple options can be combined for powerful operations:

```bash
# Force kill TCP processes on port range with JSON output
pt --range 3000-3005 --method tcp --force --json

# Dry run with custom timeouts
pt 3000 8080 --dry-run --timeout 5000 --graceful-timeout 1000

# Silent operation with force
pt 3000 --silent --force
```

### Shell Integration

#### Bash Function

Add to your `.bashrc` or `.zshrc`:

```bash
# Quick port killer function
function killport() {
  if [ -z "$1" ]; then
    echo "Usage: killport <port>"
    return 1
  fi
  pt "$1" --force
}

# Kill common dev ports
function killdevports() {
  pt 3000 3001 8080 8081 9000 --force --silent
  echo "Development ports cleaned"
}
```

#### NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "kill-port": "pt 3000",
    "clean-ports": "pt 3000 8080 9000 --force",
    "dev-clean": "pt --range 3000-3010 --force && npm run dev"
  }
}
```

### CI/CD Integration

#### GitHub Actions

```yaml
- name: Clean up ports
  run: |
    npx @oxog/port-terminator 3000 8080 --force --silent || true
    
- name: Run tests
  run: npm test
```

#### Docker

```dockerfile
RUN npm install -g @oxog/port-terminator

# In your entrypoint script
ENTRYPOINT ["sh", "-c", "pt 3000 --force --silent; exec $@", "--"]
```

## Platform-Specific Notes

### Windows

- Uses `netstat -ano` and `taskkill`
- May require administrator privileges for system processes
- Process names might be truncated

### macOS

- Uses `lsof` and `kill` commands  
- May require `sudo` for processes owned by other users
- Provides full command line information

### Linux

- Uses `lsof` (preferred) or `netstat` as fallback
- May require root privileges for system processes
- Supports various Linux distributions

## Troubleshooting

### Common Issues

#### Command Not Found
```bash
$ pt 3000
bash: pt: command not found
```

**Solution:** Install globally or use npx:
```bash
npm install -g @oxog/port-terminator
# or
npx @oxog/port-terminator 3000
```

#### Permission Denied
```bash
$ pt 80
ERROR PermissionError: Access denied
```

**Solution:** Run with elevated privileges:
```bash
sudo pt 80
# or on Windows (as Administrator)
pt 80
```

#### Port Range Parse Error
```bash
$ pt --range 3000:3005
ERROR Invalid port range format
```

**Solution:** Use hyphen for ranges:
```bash
pt --range 3000-3005
```

### Debug Information

For troubleshooting, use verbose output:

```bash
# See what's happening
pt 3000 --dry-run

# Check specific protocol
pt 3000 --method tcp --dry-run

# Use timeout for hanging operations
pt 3000 --timeout 5000
```

## Performance Tips

1. **Use specific protocols** when you know what you're targeting:
   ```bash
   pt 3000 --method tcp  # Faster than scanning both TCP and UDP
   ```

2. **Use force flag** when you don't need graceful shutdown:
   ```bash
   pt 3000 --force  # Skip graceful shutdown attempt
   ```

3. **Use ranges** instead of individual ports for bulk operations:
   ```bash
   pt --range 3000-3010  # More efficient than pt 3000 3001 3002 ...
   ```

4. **Use silent mode** in scripts to reduce I/O overhead:
   ```bash
   pt 3000 --silent
   ```