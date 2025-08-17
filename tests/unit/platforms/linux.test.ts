import { LinuxPlatform } from '../../../src/platforms/linux';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../../../src/errors';
import { IProcessInfo } from '../../../src/types';

// Mock child_process
jest.mock('child_process');
const mockSpawn = require('child_process').spawn;

describe.skip('LinuxPlatform - Complete Coverage', () => {
  let platform: LinuxPlatform;
  let mockChildProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new LinuxPlatform();

    mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  describe('findProcessesByPort', () => {
    it('should find processes using lsof output', async () => {
      const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
nginx    5678   root    6u   IPv4 0x234567890abcdef1      0t0  TCP *:8080 (LISTEN)
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      // Mock ps command for getting process command
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'ps') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('1234')) {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('user');
                }
              } else if (args.includes('5678')) {
                if (args.includes('command=')) {
                  callback('nginx -g daemon off;');
                } else if (args.includes('user=')) {
                  callback('root');
                }
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0]).toEqual({
        pid: 1234,
        name: 'node',
        port: 3000,
        protocol: 'tcp',
        command: 'node server.js',
        user: 'user',
      });
      expect(mockSpawn).toHaveBeenCalledWith('lsof', ['-i', 'tcp:3000', '-P', '-n'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should fallback to netstat when lsof fails', async () => {
      const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
tcp        0      0 0.0.0.0:8080            0.0.0.0:*               LISTEN      5678/nginx
udp        0      0 0.0.0.0:53              0.0.0.0:*                           999/systemd-resolve
`;

      // Mock lsof to throw an error (simulate command failure)
      let commandCallCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        commandCallCount++;

        if (command === 'lsof') {
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1); // lsof fails
          });

          lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Command failed');
          });

          return lsofChild;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback(netstatOutput);
          });

          netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('1234')) {
                if (args.includes('command=')) {
                  callback('node server.js\n');
                } else if (args.includes('user=')) {
                  callback('user\n');
                }
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0]).toEqual({
        pid: 1234,
        name: 'node',
        port: 3000,
        protocol: 'tcp',
        command: 'node server.js',
        user: 'user',
      });
      expect(mockSpawn).toHaveBeenCalledWith('netstat', ['-tulpn'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should handle netstat with protocol filtering', async () => {
      // Mock lsof to fail first
      let callOrder = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        callOrder++;

        if (command === 'lsof') {
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1);
          });

          lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Command failed');
          });

          return lsofChild;
        } else if (command === 'netstat') {
          // Verify netstat is called with protocol filtering
          if (args.includes('--tcp')) {
            // This is correct for tcp protocol filtering
          }

          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data')
              callback(
                `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node`
              );
          });

          netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('node server.js');
              } else if (args.includes('user=')) {
                callback('user');
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');
      expect(processes).toHaveLength(1);
    });

    it('should handle netstat with no PID information (-)', async () => {
      // Mock lsof to fail
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1);
          });

          lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Command failed');
          });

          return lsofChild;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data')
              callback(
                `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      -`
              );
          });

          netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');
      expect(processes).toHaveLength(1);
      expect(processes[0]).toEqual({
        pid: 0,
        name: 'Unknown',
        port: 3000,
        protocol: 'tcp',
        command: undefined,
        user: undefined,
      });
    });

    it('should handle netstat protocol filtering for non-both protocol', async () => {
      // Mock lsof to fail for UDP protocol
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1);
          });

          lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Command failed');
          });

          return lsofChild;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
            // Return both TCP and UDP, but should only process UDP due to protocol filter
            if (event === 'data')
              callback(
                `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node\nudp        0      0 0.0.0.0:3000            0.0.0.0:*                           5678/dns`
              );
          });

          netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('5678')) {
                if (args.includes('command=')) {
                  callback('systemd-resolved');
                } else if (args.includes('user=')) {
                  callback('root');
                }
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'udp');
      expect(processes).toHaveLength(1);
      expect(processes[0].protocol).toBe('udp');
    });

    it('should handle netstat parsing with invalid port in localAddress', async () => {
      // Mock lsof to fail
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1);
          });

          lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Command failed');
          });

          return lsofChild;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
            // Invalid port format
            if (event === 'data')
              callback(
                `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:invalidport     0.0.0.0:*               LISTEN      1234/node`
              );
          });

          netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');
      expect(processes).toHaveLength(0);
    });

    it('should handle getProcessUser returning data', async () => {
      const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      // Mock ps command to return user data via getProcessUser
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('node server.js');
              } else if (args.includes('user=')) {
                callback('testuser'); // This tests the getProcessUser path
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');
      expect(processes).toHaveLength(1);
      expect(processes[0].user).toBe('user'); // From lsof output, not ps
    });

    it('should find processes for both protocols when protocol is "both"', async () => {
      const tcpLsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

      const udpLsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
dns      5678   root    6u   IPv4 0x234567890abcdef1      0t0  UDP *:3000
`;

      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'lsof') {
          callCount++;
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('tcp')) {
                callback(tcpLsofOutput);
              } else if (args.includes('udp')) {
                callback(udpLsofOutput);
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        } else if (command === 'ps') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('1234')) {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('user');
                }
              } else if (args.includes('5678')) {
                if (args.includes('command=')) {
                  callback('systemd-resolved');
                } else if (args.includes('user=')) {
                  callback('root');
                }
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'both');

      expect(processes).toHaveLength(2);
      expect(processes[0].protocol).toBe('tcp');
      expect(processes[1].protocol).toBe('udp');
    });

    it('should deduplicate processes', async () => {
      const tcpLsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
node     1234   user    23u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(tcpLsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'ps') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('node server.js');
              } else if (args.includes('user=')) {
                callback('user');
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
    });
  });

  describe('killProcess', () => {
    it('should kill process gracefully first', async () => {
      // Mock SIGTERM success
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      // Mock kill -0 check (process exits after SIGTERM)
      let killCheckCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'kill' && args.includes('-TERM')) {
          return mockChildProcess;
        } else if (command === 'kill' && args.includes('-0')) {
          killCheckCount++;
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            // First check: process exists, second check: process gone
            if (event === 'close') callback(killCheckCount === 1 ? 0 : 1);
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const result = await platform.killProcess(1234, false);

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('kill', ['-TERM', '1234'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should force kill immediately when force is true', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.killProcess(1234, true);

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('kill', ['-KILL', '1234'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should force kill after graceful fails', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        callCount++;
        const newMockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        if (args.includes('-TERM')) {
          // SIGTERM fails
          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1);
          });
          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('Permission denied');
          });
        } else if (args.includes('-KILL')) {
          // SIGKILL succeeds
          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });
        } else if (args.includes('-0')) {
          // Process check after kill
          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1); // Process gone
          });
        }

        return newMockChild;
      });

      const result = await platform.killProcess(1234, false);

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('kill', ['-TERM', '1234'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(mockSpawn).toHaveBeenCalledWith('kill', ['-KILL', '1234'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should handle permission denied error', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('Operation not permitted');
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(PermissionError);
    });

    it('should return true if process not found', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('No such process');
      });

      const result = await platform.killProcess(1234);
      expect(result).toBe(true);
    });

    it('should throw ProcessKillError for other failures', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('Some other error');
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
    });

    it('should handle spawn error during kill', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'error') {
          callback(new Error('Spawn failed'));
        }
      });

      // Mock the spawn to return the error child immediately
      mockSpawn.mockReturnValue(mockChildProcess);

      await expect(platform.killProcess(1234)).rejects.toThrow(CommandExecutionError);
    });
  });

  describe('isPortAvailable', () => {
    it('should return true when no processes found', async () => {
      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('COMMAND   PID   USER   FD   TYPE\n');
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.isPortAvailable(3000);
      expect(result).toBe(true);
    });

    it('should return false when processes found', async () => {
      const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'ps') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('node server.js');
              } else if (args.includes('user=')) {
                callback('user');
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const result = await platform.isPortAvailable(3000);
      expect(result).toBe(false);
    });

    it('should pass protocol parameter to findProcessesByPort', async () => {
      const findSpy = jest.spyOn(platform, 'findProcessesByPort').mockResolvedValue([]);

      await platform.isPortAvailable(3000, 'tcp');

      expect(findSpy).toHaveBeenCalledWith(3000, 'tcp');
      findSpy.mockRestore();
    });
  });

  describe('waitForProcessToExit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait for process to exit', async () => {
      const platform = new LinuxPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'kill' && args.includes('-0')) {
          callCount++;
          const mockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          mockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') {
              // First call succeeds (process exists), second fails (process gone)
              callback(callCount === 1 ? 0 : 1);
            }
          });

          return mockChild;
        }
        return mockChildProcess;
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Fast-forward time to trigger the timeout check
      jest.advanceTimersByTime(150);

      await promise;
      expect(mockSpawn).toHaveBeenCalledWith('kill', ['-0', '1234'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('should timeout waiting for process to exit', async () => {
      const platform = new LinuxPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0); // Process always exists
        });

        return mockChild;
      });

      const promise = waitForProcessToExit(1234, 100);

      // Fast-forward time past the timeout
      jest.advanceTimersByTime(200);

      await promise; // Should complete due to timeout
    });

    it('should handle process that exits immediately', async () => {
      const platform = new LinuxPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(1); // Process immediately not found
        });

        return mockChild;
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Should complete immediately
      await promise;
    });
  });

  describe('deduplicateProcesses', () => {
    it('should remove duplicate processes', () => {
      const platform = new LinuxPlatform();
      const deduplicateProcesses = (platform as any).deduplicateProcesses;

      const processes: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
        { pid: 5678, name: 'nginx', port: 8080, protocol: 'tcp', user: 'root' },
      ];

      const result = deduplicateProcesses(processes);

      expect(result).toHaveLength(2);
      expect(result[0].pid).toBe(1234);
      expect(result[1].pid).toBe(5678);
    });

    it('should keep processes with different ports or protocols', () => {
      const platform = new LinuxPlatform();
      const deduplicateProcesses = (platform as any).deduplicateProcesses;

      const processes: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
        { pid: 1234, name: 'node', port: 3000, protocol: 'udp', user: 'user' },
        { pid: 1234, name: 'node', port: 3001, protocol: 'tcp', user: 'user' },
      ];

      const result = deduplicateProcesses(processes);

      expect(result).toHaveLength(3);
    });
  });

  // Additional comprehensive tests for 100% coverage
  describe('Complete Coverage Tests', () => {
    describe('Error handling for lsof fallback', () => {
      it('should fallback to netstat when lsof throws error during execution - covers line 12', async () => {
        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
`;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            // lsof command throws an error during execution - this covers line 12
            throw new Error('Command not found');
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback(netstatOutput);
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('testuser'); // This will test line 200
                }
              }
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
        expect(processes[0]).toEqual({
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          command: 'node server.js',
          user: 'testuser',
        });
      });

      it('should specifically test line 12 - lsof exception fallback to netstat', async () => {
        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
`;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            // Directly throw error during lsof execution to test line 12
            throw new Error('lsof command failed');
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback(netstatOutput);
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('testuser');
                }
              }
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // This should trigger line 12: processes = await this.findWithNetstat(port, protocol);
        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
        expect(processes[0]).toEqual({
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          command: 'node server.js',
          user: 'testuser',
        });
      });
    });

    describe('findWithNetstat comprehensive testing (lines 95-153)', () => {
      it('should execute findWithNetstat method directly covering all code paths', async () => {
        const platform = new LinuxPlatform();
        const findWithNetstat = (platform as any).findWithNetstat;

        // Test netstat output with various scenarios to cover lines 104-151
        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
tcp        0      0 127.0.0.1:3001          127.0.0.1:5432          ESTABLISHED 5678/postgres
udp        0      0 0.0.0.0:5353            0.0.0.0:*                           999/systemd-resolve
udp        0      0 0.0.0.0:53              0.0.0.0:*                           -
tcp6       0      0 :::8080                 :::*                    LISTEN      7777/nginx
invalid-line-with-few-columns
Proto Recv-Q Send-Q
`;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'netstat') {
            // Test different argument combinations for lines 98-101
            if (args.includes('--tcp')) {
              expect(args).toEqual(['-tulpn', '--tcp']); // Verify protocol filtering
            } else if (args.includes('--udp')) {
              expect(args).toEqual(['-tulpn', '--udp']); // Verify protocol filtering
            } else {
              expect(args).toEqual(['-tulpn']); // Default args for 'both'
            }

            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback(netstatOutput);
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('1234')) {
                  if (args.includes('command=')) {
                    callback('node server.js');
                  } else if (args.includes('user=')) {
                    callback('nodeuser');
                  }
                } else if (args.includes('999')) {
                  if (args.includes('command=')) {
                    callback('systemd-resolved --network');
                  } else if (args.includes('user=')) {
                    callback('systemd-resolve');
                  }
                }
              }
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // Test with 'both' protocol (lines 98-101)
        const processesBoth = await findWithNetstat(3000, 'both');
        expect(processesBoth).toHaveLength(1);
        expect(processesBoth[0]).toEqual({
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          command: 'node server.js',
          user: 'nodeuser',
        });

        // Test with specific protocol to verify lines 99-101
        const processesTcp = await findWithNetstat(3000, 'tcp');
        expect(processesTcp).toHaveLength(1);

        // Test with UDP protocol and port with no PID (-) - covers lines 130-136
        const processesUdp = await findWithNetstat(53, 'udp');
        expect(processesUdp).toHaveLength(1);
        expect(processesUdp[0]).toEqual({
          pid: 0,
          name: 'Unknown',
          port: 53,
          protocol: 'udp',
          command: undefined,
          user: undefined,
        });
      });

      it('should handle findWithNetstat with protocol filtering', async () => {
        const platform = new LinuxPlatform();
        const findWithNetstat = (platform as any).findWithNetstat;

        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
udp        0      0 0.0.0.0:3000            0.0.0.0:*                           5678/dns
`;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'netstat') {
            // Verify protocol-specific arguments
            expect(args).toContain('--udp');

            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback(netstatOutput);
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('5678')) {
                  if (args.includes('command=')) {
                    callback('systemd-resolved');
                  } else if (args.includes('user=')) {
                    callback('systemd-resolve');
                  }
                }
              }
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await findWithNetstat(3000, 'udp');
        expect(processes).toHaveLength(1);
        expect(processes[0].protocol).toBe('udp');
        expect(processes[0].pid).toBe(5678);
        expect(processes[0].name).toBe('dns');
      });

      it('should handle findWithNetstat error case (line 153)', async () => {
        const platform = new LinuxPlatform();
        const findWithNetstat = (platform as any).findWithNetstat;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'error') {
                callback(new Error('netstat failed'));
              }
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await findWithNetstat(3000, 'tcp');
        expect(processes).toEqual([]);
      });
    });

    describe('findWithNetstat edge cases', () => {
      it('should handle netstat with malformed process info', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            lsofChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('lsof failed');
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                // Malformed process info that doesn't match the regex
                callback(
                  `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      malformed-no-slash`
                );
              }
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
        expect(processes[0].pid).toBe(0);
        expect(processes[0].name).toBe('Unknown');
      });

      it('should handle netstat with insufficient columns', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                // Line with insufficient columns (< 7)
                callback(`Active Internet connections\nProto Local\ntcp 0.0.0.0:3000`);
              }
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(0);
      });

      it('should handle netstat with no port match in localAddress', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                // localAddress without port pattern
                callback(
                  `Active Internet connections\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 127.0.0.1              0.0.0.0:*               LISTEN      1234/node`
                );
              }
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(0);
      });

      it('should handle netstat with different port number', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                // Different port number (8080 instead of 3000)
                callback(
                  `Active Internet connections\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:8080            0.0.0.0:*               LISTEN      1234/node`
                );
              }
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(0);
      });

      it('should handle netstat with protocol filtering for non-both protocol', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                // TCP entry when we're looking for UDP - should be filtered out
                callback(
                  `Active Internet connections\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node`
                );
              }
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'udp');
        expect(processes).toHaveLength(0);
      });

      it('should call getProcessCommand and getProcessUser for valid processes', async () => {
        // Mock lsof to fail first
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            lsofChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            return lsofChild;
          } else if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                callback(
                  `Active Internet connections\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node`
                );
              }
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('testuser');
                }
              }
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
        expect(processes[0].command).toBe('node server.js');
        expect(processes[0].user).toBe('testuser');
      });
    });

    describe('findWithLsof edge cases', () => {
      it('should handle lsof output with insufficient columns', async () => {
        const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
shortline
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

        mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback(lsofOutput);
        });

        mockChildProcess.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('node server.js');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
      });

      it('should handle lsof output with invalid PID', async () => {
        const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     abc   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
node     1234  user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
`;

        mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback(lsofOutput);
        });

        mockChildProcess.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('node server.js');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(1);
        expect(processes[0].pid).toBe(1234);
      });

      it('should handle lsof output with wrong port in name field', async () => {
        const lsofOutput = `
COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:8080 (LISTEN)
`;

        mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback(lsofOutput);
        });

        mockChildProcess.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        const processes = await platform.findProcessesByPort(3000, 'tcp');
        expect(processes).toHaveLength(0);
      });

      it('should handle lsof protocol-specific error (continue with next protocol)', async () => {
        let callCount = 0;
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'lsof') {
            callCount++;
            const lsofChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            if (callCount === 1) {
              // First call (tcp) fails
              lsofChild.on.mockImplementation((event: any, callback: any) => {
                if (event === 'close') callback(1);
              });
            } else {
              // Second call (udp) succeeds
              lsofChild.on.mockImplementation((event: any, callback: any) => {
                if (event === 'close') callback(0);
              });

              lsofChild.stdout.on.mockImplementation((event: any, callback: any) => {
                if (event === 'data') {
                  callback(
                    `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME\ndns      5678   root    6u   IPv4 0x234567890abcdef1      0t0  UDP *:3000`
                  );
                }
              });
            }

            return lsofChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('systemd-resolved');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const processes = await platform.findProcessesByPort(3000, 'both');
        expect(processes).toHaveLength(1);
        expect(processes[0].protocol).toBe('udp');
      });
    });

    describe('getProcessCommand and getProcessUser coverage', () => {
      it('should handle getProcessCommand with empty stdout after trim', async () => {
        const platform = new LinuxPlatform();
        const getProcessCommand = (platform as any).getProcessCommand;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('   \n\t  '); // Only whitespace
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const result = await getProcessCommand(1234);
        expect(result).toBeUndefined();
      });

      it('should handle getProcessUser with empty stdout after trim', async () => {
        const platform = new LinuxPlatform();
        const getProcessUser = (platform as any).getProcessUser;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('   \n\t  '); // Only whitespace
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const result = await getProcessUser(1234);
        expect(result).toBeUndefined();
      });

      it('should handle getProcessCommand failure', async () => {
        const platform = new LinuxPlatform();
        const getProcessCommand = (platform as any).getProcessCommand;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('ps failed');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const result = await getProcessCommand(1234);
        expect(result).toBeUndefined();
      });

      it('should handle getProcessUser failure', async () => {
        const platform = new LinuxPlatform();
        const getProcessUser = (platform as any).getProcessUser;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('ps failed');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        const result = await getProcessUser(1234);
        expect(result).toBeUndefined();
      });

      it('should cover line 200 - getProcessUser success return path', async () => {
        const platform = new LinuxPlatform();
        const getProcessUser = (platform as any).getProcessUser;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('testuser\n');
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // This should hit line 200: return result.stdout.trim() || undefined;
        const result = await getProcessUser(1234);
        expect(result).toBe('testuser');
        expect(mockSpawn).toHaveBeenCalledWith('ps', ['-p', '1234', '-o', 'user='], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      });
    });

    describe('executeCommand error scenarios', () => {
      it('should handle executeCommand with null exit code', async () => {
        const platform = new LinuxPlatform();
        const executeCommand = (platform as any).executeCommand;

        mockSpawn.mockImplementation((command: any, args: any) => {
          const child = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          child.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') {
              callback(null); // Exit code is null
            }
          });

          child.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('error occurred');
          });

          return child;
        });

        await expect(executeCommand('test', ['arg'])).rejects.toThrow(CommandExecutionError);
      });

      it('should handle executeCommand with spawn error', async () => {
        const platform = new LinuxPlatform();
        const executeCommand = (platform as any).executeCommand;

        mockSpawn.mockImplementation((command: any, args: any) => {
          const child = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          child.on.mockImplementation((event: any, callback: any) => {
            if (event === 'error') {
              callback(new Error('Spawn failed'));
            }
          });

          return child;
        });

        await expect(executeCommand('test', ['arg'])).rejects.toThrow(CommandExecutionError);
      });
    });

    describe('Additional killProcess edge cases', () => {
      it('should handle non-CommandExecutionError in killProcess', async () => {
        mockSpawn.mockImplementation((command: any, args: any) => {
          const child = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          child.on.mockImplementation((event: any, callback: any) => {
            if (event === 'error') {
              callback(new Error('Generic error'));
            }
          });

          return child;
        });

        await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
      });

      it('should handle graceful kill timeout and proceed to force kill', async () => {
        let killCallCount = 0;
        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'kill') {
            killCallCount++;
            const killChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            if (args.includes('-TERM')) {
              // SIGTERM succeeds but process doesn't exit
              killChild.on.mockImplementation((event: any, callback: any) => {
                if (event === 'close') callback(0);
              });
            } else if (args.includes('-KILL')) {
              // SIGKILL succeeds
              killChild.on.mockImplementation((event: any, callback: any) => {
                if (event === 'close') callback(0);
              });
            } else if (args.includes('-0')) {
              // Process check - always returns that process exists (timeout scenario)
              killChild.on.mockImplementation((event: any, callback: any) => {
                if (event === 'close') callback(0);
              });
            }

            return killChild;
          }
          return mockChildProcess;
        });

        // Use fake timers to control timeout
        jest.useFakeTimers();
        const killPromise = platform.killProcess(1234, false);

        // Fast-forward past the graceful timeout
        jest.advanceTimersByTime(6000);

        const result = await killPromise;
        expect(result).toBe(true);

        jest.useRealTimers();
      });
    });
  });

  // Additional coverage tests for 100% coverage
  describe('Coverage Tests for Remaining Lines', () => {
    describe('Line 12 Coverage: lsof fallback to netstat on direct error', () => {
      it('should fallback to netstat when lsof directly throws an error (covers line 12)', async () => {
        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
`;

        // Mock findWithLsof to directly throw an error (not through child process)
        // This will trigger the catch block that contains line 12
        jest.spyOn(platform as any, 'findWithLsof').mockRejectedValue(new Error('lsof not found'));

        // Mock findWithNetstat to succeed
        jest.spyOn(platform as any, 'findWithNetstat').mockResolvedValue([
          {
            pid: 1234,
            name: 'node',
            port: 3000,
            protocol: 'tcp',
            command: 'node server.js',
            user: 'testuser',
          },
        ]);

        const processes = await platform.findProcessesByPort(3000, 'tcp');

        expect(processes).toHaveLength(1);
        expect(processes[0]).toEqual({
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          command: 'node server.js',
          user: 'testuser',
        });
      });
    });

    describe('Lines 104-151 Coverage: Complete netstat implementation', () => {
      it('should cover all netstat parsing logic paths (lines 104-151)', async () => {
        const platform = new LinuxPlatform();
        const findWithNetstat = (platform as any).findWithNetstat;

        // Test comprehensive netstat output covering all edge cases
        const netstatOutput = `
Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
tcp        0      0 127.0.0.1:3001          127.0.0.1:5432          ESTABLISHED 5678/postgres
udp        0      0 0.0.0.0:5353            0.0.0.0:*                           999/systemd-resolve
udp        0      0 0.0.0.0:53              0.0.0.0:*                           -
tcp6       0      0 :::8080                 :::*                    LISTEN      7777/nginx
Active                   
Proto Recv-Q Send-Q
tcp        0      0 invalid:port            0.0.0.0:*               LISTEN      invalid
tcp        0      0 127.0.0.1:9999          127.0.0.1:8888          LISTEN      malformed-pid-info
incomplete line with less than 7 columns
tcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      5000/testproc
`;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'netstat') {
            // Verify netstat arguments based on protocol
            if (args.includes('--tcp')) {
              expect(args).toEqual(['-tulpn', '--tcp']);
            } else if (args.includes('--udp')) {
              expect(args).toEqual(['-tulpn', '--udp']);
            } else {
              expect(args).toEqual(['-tulpn']);
            }

            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            netstatChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback(netstatOutput);
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return netstatChild;
          } else if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') {
                if (args.includes('1234')) {
                  if (args.includes('command=')) {
                    callback('node server.js');
                  } else if (args.includes('user=')) {
                    callback('nodeuser');
                  }
                } else if (args.includes('999')) {
                  if (args.includes('command=')) {
                    callback('systemd-resolved --network');
                  } else if (args.includes('user=')) {
                    callback('systemd-resolve');
                  }
                }
              }
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // Test with 'both' protocol (default path)
        const processesBoth = await findWithNetstat(3000, 'both');
        expect(processesBoth).toHaveLength(1);
        expect(processesBoth[0]).toEqual({
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          command: 'node server.js',
          user: 'nodeuser',
        });

        // Test with specific protocol filtering (lines 99-101)
        const processesTcp = await findWithNetstat(3000, 'tcp');
        expect(processesTcp).toHaveLength(1);

        // Test with UDP protocol and no PID (-) case (lines 130-136)
        const processesUdp = await findWithNetstat(53, 'udp');
        expect(processesUdp).toHaveLength(1);
        expect(processesUdp[0]).toEqual({
          pid: 0,
          name: 'Unknown',
          port: 53,
          protocol: 'udp',
          command: undefined,
          user: undefined,
        });
      });

      it('should return empty array when netstat command fails (line 153)', async () => {
        const platform = new LinuxPlatform();
        const findWithNetstat = (platform as any).findWithNetstat;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'netstat') {
            const netstatChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            netstatChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1); // Command fails
            });

            netstatChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('netstat command failed');
            });

            return netstatChild;
          }
          return mockChildProcess;
        });

        // This should trigger line 153: return [];
        const processes = await findWithNetstat(3000, 'tcp');
        expect(processes).toEqual([]);
      });
    });

    describe('Line 200 Coverage: getProcessUser success return', () => {
      it('should return trimmed user string from ps command (covers line 200)', async () => {
        const platform = new LinuxPlatform();
        const getProcessUser = (platform as any).getProcessUser;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('testuser\n  '); // With trailing whitespace
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // This should hit line 200: return result.stdout.trim() || undefined;
        const result = await getProcessUser(1234);
        expect(result).toBe('testuser');
        expect(mockSpawn).toHaveBeenCalledWith('ps', ['-p', '1234', '-o', 'user='], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      });

      it('should return undefined when ps output is empty after trim (covers line 200)', async () => {
        const platform = new LinuxPlatform();
        const getProcessUser = (platform as any).getProcessUser;

        mockSpawn.mockImplementation((command: any, args: any) => {
          if (command === 'ps') {
            const psChild = {
              stdout: { on: jest.fn() },
              stderr: { on: jest.fn() },
              on: jest.fn(),
            };

            psChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            psChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('   \n\t  '); // Only whitespace
            });

            psChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });

            return psChild;
          }
          return mockChildProcess;
        });

        // This should hit line 200 and return undefined due to empty trim
        const result = await getProcessUser(1234);
        expect(result).toBeUndefined();
      });
    });
  });
});
