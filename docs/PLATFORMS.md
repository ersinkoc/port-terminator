# Platform-Specific Documentation

This document provides detailed information about how `@oxog/port-terminator` works on different operating systems and platforms.

## Supported Platforms

- **Windows** (win32)
- **macOS** (darwin)  
- **Linux** (linux)

## Windows Implementation

### Process Discovery

**Primary Method: `netstat -ano`**

```bash
netstat -ano
```

- Lists all network connections with associated Process IDs (PIDs)
- Shows protocol (TCP/UDP), local address, remote address, state, and PID
- Works consistently across all Windows versions
- No additional permissions required for reading

**Output Format:**
```
Proto  Local Address          Foreign Address        State           PID
TCP    0.0.0.0:3000          0.0.0.0:0              LISTENING       1234
UDP    0.0.0.0:8080          *:*                                    5678
```

### Process Termination

**Primary Method: `taskkill`**

```bash
# Graceful termination
taskkill /PID 1234

# Force termination  
taskkill /F /PID 1234
```

**Termination Strategy:**
1. First attempt graceful termination without `/F` flag
2. Wait for process to exit (configurable timeout)
3. If graceful fails, use force termination with `/F` flag

### Process Information Gathering

**Process Name: `tasklist`**
```bash
tasklist /FI "PID eq 1234" /FO CSV /NH
```

**Process Command: `wmic`**
```bash
wmic process where ProcessId=1234 get CommandLine /format:value
```

### Windows-Specific Considerations

#### Permissions
- Regular user can terminate own processes
- Administrator privileges required for system processes
- Some protected processes cannot be terminated even by administrators

#### Common Issues
- **Access Denied**: Process is owned by another user/system
- **Process Not Found**: Process may have already exited
- **Protected Process**: Some system processes are protected from termination

#### Error Messages
- `ERROR: Access is denied` - Insufficient permissions
- `ERROR: The process "1234" not found` - Process doesn't exist
- `ERROR: The process with PID 1234 could not be terminated` - Process is protected

### Windows Code Example

```typescript
// Windows-specific process finding
const netstatResult = await executeCommand('netstat', ['-ano']);
const lines = netstatResult.stdout.split('\n');

for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts.length >= 5) {
    const [proto, localAddress, , state, pidStr] = parts;
    const portMatch = localAddress.match(/:(\d+)$/);
    if (portMatch && parseInt(portMatch[1]) === targetPort) {
      // Found process on target port
    }
  }
}
```

## macOS Implementation

### Process Discovery

**Primary Method: `lsof -i :<port>`**

```bash
lsof -i :3000 -P -n
```

- `-P` prevents port name resolution (shows numeric ports)
- `-n` prevents hostname resolution (shows numeric IPs)
- Provides comprehensive process information
- Requires lsof to be installed (usually pre-installed)

**Fallback Method: `netstat -an`**

```bash
netstat -an -p tcp
```

Used when lsof is not available or fails.

**Output Format (lsof):**
```
COMMAND  PID USER   FD   TYPE   DEVICE SIZE/OFF NODE NAME
node    1234 user   22u  IPv4  0x1234    0t0  TCP *:3000 (LISTEN)
```

### Process Termination

**Signal-based Termination:**

```bash
# Graceful termination (SIGTERM)
kill -TERM 1234

# Force termination (SIGKILL)  
kill -KILL 1234
```

**Termination Strategy:**
1. Send SIGTERM signal for graceful shutdown
2. Wait for process to exit (configurable timeout)
3. If graceful fails, send SIGKILL signal for immediate termination

### Process Information Gathering

**Process Command: `ps`**
```bash
ps -p 1234 -o command=
```

Gets the full command line for the process.

### macOS-Specific Considerations

#### Permissions
- User can terminate own processes without sudo
- Root/admin privileges required for processes owned by other users
- System processes may require SIP (System Integrity Protection) to be disabled

#### Common Issues
- **Operation not permitted**: Insufficient permissions for process
- **No such process**: Process exited between discovery and termination
- **SIP Protection**: Some system processes are protected by SIP

#### macOS Versions
- Works on macOS 10.9+ (all versions with lsof)
- Consistent behavior across Intel and Apple Silicon Macs
- May have slight output format differences in newer versions

### macOS Code Example

```typescript
// macOS-specific process finding with lsof
const lsofResult = await executeCommand('lsof', ['-i', `:${port}`, '-P', '-n']);
const lines = lsofResult.stdout.split('\n');

for (const line of lines) {
  if (!line.trim() || line.startsWith('COMMAND')) continue;
  
  const parts = line.trim().split(/\s+/);
  if (parts.length >= 9) {
    const [command, pidStr, user, , , , , , name] = parts;
    if (name.includes(`:${port}`)) {
      // Found process on target port
    }
  }
}
```

## Linux Implementation

### Process Discovery

**Primary Method: `lsof -i :<port>`**

```bash  
lsof -i :3000 -P -n
```

Same as macOS, preferred when available.

**Fallback Method: `netstat -tulpn`**

```bash
netstat -tulpn
```

- `-t` TCP connections
- `-u` UDP connections  
- `-l` Listening ports only
- `-p` Show PID and process name
- `-n` Numeric output (no name resolution)

**Output Format (netstat):**
```
Proto Recv-Q Send-Q Local Address   Foreign Address   State    PID/Program name
tcp   0      0      0.0.0.0:3000    0.0.0.0:*         LISTEN   1234/node
udp   0      0      0.0.0.0:8080    0.0.0.0:*                  5678/nginx
```

### Process Termination

**Signal-based Termination:**

```bash
# Graceful termination (SIGTERM)
kill -TERM 1234

# Force termination (SIGKILL)
kill -KILL 1234
```

Same approach as macOS with signal-based termination.

### Process Information Gathering

**Process Command: `ps`**
```bash
ps -p 1234 -o command=
```

**Process User: `ps`**
```bash
ps -p 1234 -o user=
```

### Linux Distribution Support

#### Ubuntu/Debian
- lsof usually pre-installed
- netstat available in `net-tools` package
- May need `sudo apt install net-tools` on minimal installations

#### CentOS/RHEL/Fedora
- lsof available in standard repositories
- netstat in `net-tools` package
- Use `yum install net-tools` or `dnf install net-tools`

#### Alpine Linux
- Minimal installation may not include lsof
- busybox netstat has limited functionality
- May need `apk add lsof` for full functionality

#### Arch Linux
- lsof in core repositories
- netstat in `net-tools` package
- Use `pacman -S net-tools lsof`

### Linux-Specific Considerations

#### Permissions
- User can terminate own processes
- Root privileges required for processes owned by other users
- systemd processes may require special handling

#### Container Environments
- Works in Docker containers with appropriate capabilities
- May need `--cap-add=SYS_PTRACE` for full lsof functionality
- Kubernetes pods inherit host networking considerations

#### Network Namespaces
- Processes in different network namespaces may not be visible
- Container isolation affects port visibility
- Root privileges may be needed to see all namespaces

#### Common Issues
- **Operation not permitted**: Insufficient permissions
- **No such process**: Process exited or in different PID namespace
- **Command not found**: lsof or netstat not installed

### Linux Code Example

```typescript
// Linux-specific process finding with netstat fallback
try {
  // Try lsof first
  const lsofResult = await executeCommand('lsof', ['-i', `:${port}`, '-P', '-n']);
  return this.parseLsofOutput(lsofResult.stdout, port);
} catch (error) {
  // Fallback to netstat
  const netstatResult = await executeCommand('netstat', ['-tulpn']);
  return this.parseNetstatOutput(netstatResult.stdout, port);
}
```

## Cross-Platform Considerations

### Common Patterns

#### Process Lifecycle
1. **Discovery**: Find processes using platform-specific commands
2. **Validation**: Verify process information and permissions
3. **Termination**: Attempt graceful termination first
4. **Verification**: Confirm process termination
5. **Force Kill**: Use force termination if graceful fails

#### Error Handling
- **Permission Errors**: Consistent handling across platforms
- **Process Not Found**: Handle race conditions where process exits
- **Timeout Handling**: Configurable timeouts for all operations
- **Command Failures**: Fallback strategies when primary commands fail

### Performance Characteristics

#### Windows
- `netstat -ano` is fast and reliable
- `tasklist` and `wmic` can be slower for process info
- Force termination is immediate and effective

#### macOS/Linux
- `lsof` is very fast and comprehensive
- `netstat` fallback is reliable but provides less information
- Signal-based termination allows for proper cleanup

### Security Considerations

#### Privilege Escalation
- Never runs commands with elevated privileges automatically
- Provides clear error messages when privileges are insufficient
- Suggests using sudo/Administrator when appropriate

#### Command Injection Prevention
- All command arguments are properly escaped
- No shell interpretation of user input
- Uses spawn() instead of exec() for security

#### Process Validation
- Verifies process IDs before termination attempts
- Checks process ownership when possible
- Prevents termination of critical system processes

## Testing Across Platforms

### Automated Testing

The package includes platform-specific tests that:

1. **Mock platform detection** to test all code paths
2. **Simulate command outputs** from different operating systems  
3. **Test error conditions** specific to each platform
4. **Verify cross-platform consistency** of the API

### Manual Testing

For manual testing across platforms:

```bash
# Test basic functionality
npm test

# Test on specific platform
npm run test:windows
npm run test:macos  
npm run test:linux

# Test with real processes
node -e "require('http').createServer().listen(3000)" &
port-terminator 3000
```

### CI/CD Testing

The project uses GitHub Actions to test on:
- Windows Server 2019/2022
- macOS 11/12
- Ubuntu 18.04/20.04/22.04

## Troubleshooting by Platform

### Windows Issues

**"Access is denied" errors:**
```bash
# Run as Administrator
runas /user:Administrator "cmd"
port-terminator 80
```

**Process not found after discovery:**
- Windows processes can exit quickly
- Try with `--force` flag for immediate termination
- Check if process is actually a Windows Service

### macOS Issues

**"Operation not permitted" errors:**
```bash  
# Use sudo for other users' processes
sudo port-terminator 80

# Check SIP status
csrutil status
```

**lsof not found:**
```bash
# Install lsof (usually pre-installed)
brew install lsof
```

### Linux Issues

**Command not found errors:**
```bash
# Install missing tools
sudo apt-get install lsof net-tools  # Debian/Ubuntu
sudo yum install lsof net-tools      # RHEL/CentOS
sudo pacman -S lsof net-tools        # Arch
```

**Permission denied in containers:**
```bash
# Run container with additional capabilities
docker run --cap-add=SYS_PTRACE your-image

# Or run as privileged (less secure)
docker run --privileged your-image
```

## Platform-Specific Optimizations

### Windows
- Uses CSV output from tasklist for easier parsing
- Caches process information to reduce wmic calls
- Handles Windows-specific process states (suspended, etc.)

### macOS
- Prefers lsof for rich process information
- Uses ps command for additional process details
- Handles macOS-specific process attributes

### Linux  
- Implements multiple fallback strategies
- Supports different Linux distribution variations
- Handles container and namespace scenarios

This comprehensive platform support ensures that `@oxog/port-terminator` works reliably across all major development and production environments.