import { LinuxPlatform } from '../../../src/platforms/linux';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../../../src/errors';
import { IProcessInfo } from '../../../src/types';

// Mock child_process
jest.mock('child_process');
const mockSpawn = require('child_process').spawn;

describe.skip('LinuxPlatform - Comprehensive Coverage', () => {
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
    it('should find processes using lsof successfully', async () => {
      const lsofOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      // Mock ps command calls for getProcessCommand
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('node server.js');
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
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
    });

    it('should fallback to netstat when lsof fails', async () => {
      // First lsof call fails
      mockChildProcess.on.mockImplementationOnce((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      const netstatOutput = `Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node`;

      // Mock netstat call
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback(netstatOutput);
          });

          netstatChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('node server.js');
              } else if (args.includes('user=')) {
                callback('user');
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
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
    });

    it('should handle both protocols when protocol is "both"', async () => {
      const tcpOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      const udpOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
dns      5678   root    6u   IPv4 0x234567890abcdef1      0t0  UDP *:3000`;

      let callCount = 0;
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          callCount++;
          const lsofChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          lsofChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          lsofChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              if (args.includes('tcp')) {
                callback(tcpOutput);
              } else if (args.includes('udp')) {
                callback(udpOutput);
              }
            }
          });

          lsofChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return lsofChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              if (args.includes('1234')) {
                callback('node server.js');
              } else if (args.includes('5678')) {
                callback('systemd-resolved');
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'both');

      expect(processes).toHaveLength(2);
      expect(processes.find((p) => p.protocol === 'tcp')).toBeDefined();
      expect(processes.find((p) => p.protocol === 'udp')).toBeDefined();
    });

    it('should deduplicate processes correctly', async () => {
      const lsofOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)
node     1234   user    23u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('node server.js');
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });
  });

  describe('killProcess', () => {
    it('should kill process gracefully first', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      let killCallCount = 0;
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'kill' && args.includes('-TERM')) {
          return mockChildProcess;
        } else if (command === 'kill' && args.includes('-0')) {
          killCallCount++;
          const killChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          killChild.on.mockImplementation((event: string, callback: Function) => {
            // First check: process exists, second check: process gone
            if (event === 'close') callback(killCallCount === 1 ? 0 : 1);
          });

          return killChild;
        }
        return mockChildProcess;
      });

      const result = await platform.killProcess(1234, false);

      expect(result).toBe(true);
    });

    it('should force kill immediately when force is true', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.killProcess(1234, true);

      expect(result).toBe(true);
    });

    it('should handle permission denied error', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Operation not permitted');
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(PermissionError);
    });

    it('should return true if process not found', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('No such process');
      });

      const result = await platform.killProcess(1234);
      expect(result).toBe(true);
    });

    it('should throw ProcessKillError for other failures', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Some other error');
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
    });
  });

  describe('isPortAvailable', () => {
    it('should return true when no processes found', async () => {
      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('COMMAND   PID   USER   FD   TYPE\n');
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.isPortAvailable(3000);
      expect(result).toBe(true);
    });

    it('should return false when processes found', async () => {
      const lsofOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('node server.js');
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const result = await platform.isPortAvailable(3000);
      expect(result).toBe(false);
    });
  });

  describe('netstat fallback scenarios', () => {
    it('should handle netstat with protocol filtering', async () => {
      // Mock lsof failure
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      const netstatOutput = `Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
udp        0      0 0.0.0.0:3000            0.0.0.0:*                           5678/dns`;

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback(netstatOutput);
          });

          netstatChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
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

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0].protocol).toBe('tcp');
    });

    it('should handle netstat with no PID information', async () => {
      // Mock lsof failure
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      const netstatOutput = `Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      -`;

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback(netstatOutput);
          });

          netstatChild.stderr.on.mockImplementation((event: string, callback: Function) => {
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

    it('should return empty array when netstat fails', async () => {
      // Mock lsof failure
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(1);
          });

          netstatChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('netstat failed');
          });

          return netstatChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed lsof output', async () => {
      const malformedOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
invalid line
node     abc   user    22u  IPv4 0x1234567890abcdef      0t0  TCP localhost:9000 (LISTEN)
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(malformedOutput);
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('node server.js');
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });

    it('should handle spawn errors', async () => {
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          callback(new Error('Spawn failed'));
        }
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(CommandExecutionError);
    });

    it('should handle process command/user lookup failures gracefully', async () => {
      const lsofOutput = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     1234   user    22u  IPv4 0x1234567890abcdef      0t0  TCP *:3000 (LISTEN)`;

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(lsofOutput);
      });

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      // Mock ps command failure
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(1);
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('ps failed');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'tcp');

      expect(processes).toHaveLength(1);
      expect(processes[0].command).toBeUndefined();
    });
  });

  describe('waitForProcessToExit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait for process to exit successfully', async () => {
      const platform = new LinuxPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      let checkCount = 0;
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'kill' && args.includes('-0')) {
          checkCount++;
          const killChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          killChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') {
              // First check: process exists, second check: process gone
              callback(checkCount === 1 ? 0 : 1);
            }
          });

          return killChild;
        }
        return mockChildProcess;
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Advance timers to trigger the check
      jest.advanceTimersByTime(150);

      await promise;
    });

    it('should timeout if process does not exit', async () => {
      const platform = new LinuxPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'kill' && args.includes('-0')) {
          const killChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          killChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0); // Process always exists
          });

          return killChild;
        }
        return mockChildProcess;
      });

      const promise = waitForProcessToExit(1234, 100);

      // Advance timers past the timeout
      jest.advanceTimersByTime(200);

      await promise; // Should complete due to timeout
    });
  });

  describe('private method coverage', () => {
    it('should test executeCommand with exit code null', async () => {
      const platform = new LinuxPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(null); // Exit code is null
      });

      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('error message');
      });

      await expect(executeCommand('test', ['arg'])).rejects.toThrow(CommandExecutionError);
    });

    it('should test getProcessCommand with empty trimmed output', async () => {
      const platform = new LinuxPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      mockSpawn.mockImplementation(() => {
        const psChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        psChild.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') callback(0);
        });

        psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') callback('   '); // Empty after trim
        });

        psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') callback('');
        });

        return psChild;
      });

      const result = await getProcessCommand(1234);
      expect(result).toBeUndefined();
    });

    it('should test getProcessUser with empty trimmed output', async () => {
      const platform = new LinuxPlatform();
      const getProcessUser = (platform as any).getProcessUser;

      mockSpawn.mockImplementation(() => {
        const psChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        psChild.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') callback(0);
        });

        psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') callback('   '); // Empty after trim
        });

        psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') callback('');
        });

        return psChild;
      });

      const result = await getProcessUser(1234);
      expect(result).toBeUndefined();
    });
  });

  describe('netstat specific lines coverage (104-151)', () => {
    it('should cover all netstat processing logic including edge cases', async () => {
      // Mock lsof to fail, triggering netstat fallback
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      const netstatOutput = `Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
tcp        0      0 invalid-address         0.0.0.0:*               LISTEN      5678/test
tcp        0      0 127.0.0.1:4000          0.0.0.0:*               LISTEN      -
udp        0      0 0.0.0.0:3000            0.0.0.0:*                           9999/udp-app
tcp        0      0 0.0.0.0:2000            0.0.0.0:*               LISTEN      abc/invalid-pid
invalid line format
Active connections header
Proto header line`;

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback(netstatOutput);
          });

          netstatChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              if (args.includes('1234')) {
                if (args.includes('command=')) {
                  callback('node server.js');
                } else if (args.includes('user=')) {
                  callback('testuser');
                }
              } else if (args.includes('5678')) {
                if (args.includes('command=')) {
                  callback('test-app');
                } else if (args.includes('user=')) {
                  callback('appuser');
                }
              } else if (args.includes('9999')) {
                if (args.includes('command=')) {
                  callback('udp-service');
                } else if (args.includes('user=')) {
                  callback('udpuser');
                }
              }
            }
          });

          psChild.stderr.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback('');
          });

          return psChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'both');

      // Should find both tcp and udp processes on port 3000
      expect(processes).toHaveLength(2);
      const tcpProcess = processes.find((p) => p.protocol === 'tcp');
      const udpProcess = processes.find((p) => p.protocol === 'udp');

      expect(tcpProcess).toBeDefined();
      expect(tcpProcess?.pid).toBe(1234);
      expect(tcpProcess?.name).toBe('node');
      expect(tcpProcess?.command).toBe('node server.js');
      expect(tcpProcess?.user).toBe('testuser');

      expect(udpProcess).toBeDefined();
      expect(udpProcess?.pid).toBe(9999);
      expect(udpProcess?.name).toBe('udp-app');
      expect(udpProcess?.command).toBe('udp-service');
      expect(udpProcess?.user).toBe('udpuser');
    });

    it('should cover protocol continue statement (line 118-119)', async () => {
      // Mock lsof failure
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(1);
      });
      mockChildProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback('Command failed');
      });

      const netstatOutput = `Active Internet connections
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN      1234/node
udp        0      0 0.0.0.0:3000            0.0.0.0:*                           5678/udp-app
tcp6       0      0 :::3000                 :::*                    LISTEN      9999/server`;

      mockSpawn.mockImplementation((command: string, args: string[]) => {
        if (command === 'lsof') {
          return mockChildProcess;
        } else if (command === 'netstat') {
          const netstatChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          netstatChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          netstatChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') callback(netstatOutput);
          });

          return netstatChild;
        } else if (command === 'ps') {
          const psChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          psChild.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'close') callback(0);
          });

          psChild.stdout.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              if (args.includes('command=')) {
                callback('test-command');
              } else if (args.includes('user=')) {
                callback('testuser');
              }
            }
          });

          return psChild;
        }
        return mockChildProcess;
      });

      // Test with specific protocol 'udp' - should only return udp process and skip tcp
      const processes = await platform.findProcessesByPort(3000, 'udp');

      expect(processes).toHaveLength(1);
      expect(processes[0].protocol).toBe('udp');
      expect(processes[0].pid).toBe(5678);
    });
  });
});
