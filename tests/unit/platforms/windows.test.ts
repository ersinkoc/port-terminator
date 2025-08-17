import { WindowsPlatform } from '../../../src/platforms/windows';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../../../src/errors';

// Mock child_process
jest.mock('child_process');
const mockSpawn = require('child_process').spawn;

describe('WindowsPlatform', () => {
  let platform: WindowsPlatform;
  let mockChildProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new WindowsPlatform();

    mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  describe('findProcessesByPort', () => {
    it('should find processes using netstat output', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       5678
  UDP    0.0.0.0:53             *:*                                    9999
`;

      const tasklist1Output = '"node.exe","1234","Console","1","32,768 K"';
      const tasklist2Output = '"nginx.exe","5678","Console","1","16,384 K"';
      const wmicOutput1 = 'CommandLine=node server.js';
      const wmicOutput2 = 'CommandLine=';

      // Mock netstat call
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') {
          callback(0);
        }
      });

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') {
          callback(netstatOutput);
        }
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') {
          callback('');
        }
      });

      // Mock tasklist calls
      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        callCount++;
        if (command === 'netstat') {
          return mockChildProcess;
        } else if (command === 'tasklist') {
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
                callback(tasklist1Output);
              } else if (args.includes('5678')) {
                callback(tasklist2Output);
              }
            }
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        } else if (command === 'wmic') {
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
                callback(wmicOutput1);
              } else {
                callback(wmicOutput2);
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
        name: 'node.exe',
        port: 3000,
        protocol: 'tcp',
        command: 'node server.js',
        user: undefined,
      });
      expect(mockSpawn).toHaveBeenCalledWith('netstat', ['-ano']);
    });

    it('should find UDP processes when protocol is udp', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  UDP    0.0.0.0:3000           *:*                                    5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('"dns.exe","5678","Console","1","16,384 K"');
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000, 'udp');

      expect(processes).toHaveLength(1);
      expect(processes[0].protocol).toBe('udp');
      expect(processes[0].pid).toBe(5678);
    });

    it('should find both TCP and UDP processes when protocol is both', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  UDP    0.0.0.0:3000           *:*                                    5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      let tasklistCallCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          tasklistCallCount++;
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
                callback('"node.exe","1234","Console","1","32,768 K"');
              } else if (args.includes('5678')) {
                callback('"dns.exe","5678","Console","1","16,384 K"');
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

    it('should handle netstat command execution error', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') {
          callback(1);
        }
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') {
          callback('Command failed');
        }
      });

      await expect(platform.findProcessesByPort(3000)).rejects.toThrow(CommandExecutionError);
    });

    it('should handle spawn error', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'error') {
          callback(new Error('Spawn failed'));
        }
      });

      await expect(platform.findProcessesByPort(3000)).rejects.toThrow(CommandExecutionError);
    });

    it('should skip non-listening TCP connections', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           192.168.1.1:80         ESTABLISHED     1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('"nginx.exe","5678","Console","1","16,384 K"');
          });

          newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
    });

    it('should handle malformed netstat output', async () => {
      const netstatOutput = `
Active Connections
Invalid line
  Proto
  TCP    0.0.0.0
  TCP    invalid:port           0.0.0.0:0              LISTENING       invalid
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(0);
    });

    it('should skip lines without port match', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:9000           0.0.0.0:0              LISTENING       5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(0);
    });

    it('should continue processing when getProcessName fails', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      let tasklistCallCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          tasklistCallCount++;
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          if (args.includes('1234')) {
            // First tasklist call fails
            newMockChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });
            newMockChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('Process not found');
            });
          } else {
            // Second tasklist call succeeds
            newMockChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });
            newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('"nginx.exe","5678","Console","1","16,384 K"');
            });
          }

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
    });

    it('should skip lines with insufficient parts', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address
  TCP    incomplete line
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('"node.exe","1234","Console","1","32,768 K"');
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });
  });

  describe('killProcess', () => {
    it('should kill process gracefully by default', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'taskkill') {
          expect(args).toEqual(['/PID', '1234']);
          return mockChildProcess;
        } else if (command === 'tasklist') {
          // Process check after kill - simulate process is gone
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(1); // Process not found
          });

          return newMockChild;
        }
        return mockChildProcess;
      });

      const result = await platform.killProcess(1234, false);
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('taskkill', ['/PID', '1234']);
    });

    it('should force kill when requested', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.killProcess(1234, true);
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('taskkill', ['/F', '/PID', '1234']);
    });

    it('should handle access denied error', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('Access is denied');
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(PermissionError);
    });

    it('should return true if process not found', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('The process "1234" not found');
      });

      const result = await platform.killProcess(1234);
      expect(result).toBe(true);
    });

    it('should return true if process not running', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('The process is not running');
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

      await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
    });
  });

  describe('isPortAvailable', () => {
    it('should return true when no processes found', async () => {
      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('Active Connections\n\n  Proto  Local Address');
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      const result = await platform.isPortAvailable(3000);
      expect(result).toBe(true);
    });

    it('should return false when processes found', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'tasklist') {
          const newMockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          newMockChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          newMockChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('"node.exe","1234","Console","1","32,768 K"');
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

  describe('parseCSVLine', () => {
    it('should parse CSV line correctly', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine('"node.exe","1234","Console","1","32,768 K"');
      expect(result).toEqual(['node.exe', '1234', 'Console', '1', '32,768 K']);
    });

    it('should handle CSV with commas inside quotes', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine('"app, with comma","1234","Console","1","32,768 K"');
      expect(result).toEqual(['app, with comma', '1234', 'Console', '1', '32,768 K']);
    });

    it('should handle unquoted values', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine('node.exe,1234,Console,1,32768');
      expect(result).toEqual(['node.exe', '1234', 'Console', '1', '32768']);
    });

    it('should handle mixed quoted and unquoted values', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine('"node.exe",1234,"Console",1,32768');
      expect(result).toEqual(['node.exe', '1234', 'Console', '1', '32768']);
    });

    it('should handle empty string', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine('');
      expect(result).toEqual(['']);
    });

    it('should handle line with only commas', () => {
      const platform = new WindowsPlatform();
      const parseCSVLine = (platform as any).parseCSVLine;

      const result = parseCSVLine(',,,');
      expect(result).toEqual(['', '', '', '']);
    });
  });

  describe('getProcessName', () => {
    it('should get process name from tasklist', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('"node.exe","1234","Console","1","32,768 K"');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const name = await getProcessName(1234);
      expect(name).toBe('node.exe');
      expect(mockSpawn).toHaveBeenCalledWith('tasklist', [
        '/FI',
        'PID eq 1234',
        '/FO',
        'CSV',
        '/NH',
      ]);
    });

    it('should return Unknown on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(1);
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('Error');
        });

        return mockChild;
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });

    it('should return Unknown when no lines returned', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });

    it('should return Unknown when CSV parsing returns empty array', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback(',,,');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });
  });

  describe('getProcessCommand', () => {
    it('should get process command from wmic', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('CommandLine=node server.js\n\n');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const command = await getProcessCommand(1234);
      expect(command).toBe('node server.js');
      expect(mockSpawn).toHaveBeenCalledWith('wmic', [
        'process',
        'where',
        'ProcessId=1234',
        'get',
        'CommandLine',
        '/format:value',
      ]);
    });

    it('should return undefined when command is empty', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('CommandLine=\n\n');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(1);
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('Error');
        });

        return mockChild;
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });

    it('should return undefined when no CommandLine found', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('SomeOtherProperty=value\n\n');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });
  });

  describe('getProcessUser', () => {
    it('should return undefined (Windows does not implement user retrieval)', async () => {
      const platform = new WindowsPlatform();
      const getProcessUser = (platform as any).getProcessUser;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(0);
        });

        mockChild.stdout.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('ExecutablePath=C:\\path\\to\\exe');
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('');
        });

        return mockChild;
      });

      const user = await getProcessUser(1234);
      expect(user).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessUser = (platform as any).getProcessUser;

      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
        };

        mockChild.on.mockImplementation((event: any, callback: any) => {
          if (event === 'close') callback(1);
        });

        mockChild.stderr.on.mockImplementation((event: any, callback: any) => {
          if (event === 'data') callback('Error');
        });

        return mockChild;
      });

      const user = await getProcessUser(1234);
      expect(user).toBeUndefined();
    });
  });

  describe('executeCommand', () => {
    it('should execute command with windowsHide option', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockSpawn.mockImplementation((command: any, args: any, options: any) => {
        expect(options.windowsHide).toBe(true);
        expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
        return mockChildProcess;
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('test output');
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('');
      });

      const result = await executeCommand('test', ['arg1']);
      expect(result.stdout).toBe('test output');
      expect(result.exitCode).toBe(0);
    });

    it('should handle spawn error', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'error') {
          callback(new Error('Spawn failed'));
        }
      });

      await expect(executeCommand('test', ['arg1'])).rejects.toThrow(CommandExecutionError);
    });

    it('should reject on non-zero exit code', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(1);
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback('Error message');
      });

      await expect(executeCommand('test', ['arg1'])).rejects.toThrow(CommandExecutionError);
    });

    it('should accumulate stdout and stderr data', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') {
          callback('part1');
          callback('part2');
        }
      });

      mockChildProcess.stderr.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') {
          callback('error1');
          callback('error2');
        }
      });

      const result = await executeCommand('test', ['arg1']);
      expect(result.stdout).toBe('part1part2');
      expect(result.stderr).toBe('error1error2');
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
      const platform = new WindowsPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
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
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Fast-forward time to trigger the timeout check
      jest.advanceTimersByTime(150);

      await promise;
      expect(mockSpawn).toHaveBeenCalledWith('tasklist', ['/FI', 'PID eq 1234', '/FO', 'CSV']);
    });

    it('should timeout waiting for process to exit', async () => {
      const platform = new WindowsPlatform();
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
      const platform = new WindowsPlatform();
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

  // Additional coverage test for line 58
  describe('Error handling in process info gathering', () => {
    it('should continue processing when getProcessName/Command/User fails - covers line 58', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       5678
`;

      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'netstat') {
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
        } else if (command === 'tasklist') {
          callCount++;
          const tasklistChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          if (callCount === 1) {
            // First call (PID 1234) - simulate error
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'error') {
                callback(new Error('Access denied'));
              }
            });
          } else {
            // Second call (PID 5678) - simulate success
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            tasklistChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('"node.exe","5678","Console","1","32,768 K"');
            });

            tasklistChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });
          }

          return tasklistChild;
        } else if (command === 'wmic') {
          const wmicChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          wmicChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          wmicChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('5678')) {
                callback('CommandLine=node server.js');
              }
            }
          });

          wmicChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return wmicChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);

      // Should only return one process (PID 5678) since PID 1234 failed and was skipped via line 58
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('node.exe');
    });

    it('should specifically test line 58 - continue on error during process info gathering', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'netstat') {
          return mockChildProcess;
        } else if (command === 'tasklist') {
          callCount++;
          const tasklistChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          if (callCount === 1) {
            // First call (PID 1234) - simulate throwing error to hit line 58
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'error') {
                callback(new Error('Process access denied'));
              }
            });
          } else {
            // Second call (PID 5678) - simulate success
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            tasklistChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('"success.exe","5678","Console","1","32,768 K"');
            });

            tasklistChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });
          }

          return tasklistChild;
        } else if (command === 'wmic') {
          const wmicChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          wmicChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          wmicChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('5678')) {
                callback('CommandLine=success.exe --test');
              }
            }
          });

          wmicChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return wmicChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute "continue;" when PID 1234 fails, so only PID 5678 should be returned
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('success.exe');
      expect(processes[0].command).toBe('success.exe --test');
    });
  });

  // Additional coverage test for line 58
  describe('Complete Coverage for line 58', () => {
    it('should execute continue statement on line 58 when process info gathering fails', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      let callCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'netstat') {
          return mockChildProcess;
        } else if (command === 'tasklist') {
          callCount++;
          const tasklistChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          if (callCount === 1) {
            // First call (PID 1234) - simulate error to trigger line 58
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'error') {
                callback(new Error('Access denied'));
              }
            });
          } else {
            // Second call (PID 5678) - simulate success
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            tasklistChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('"success.exe","5678","Console","1","32,768 K"');
            });

            tasklistChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });
          }

          return tasklistChild;
        } else if (command === 'wmic') {
          const wmicChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          wmicChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          wmicChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('5678')) {
                callback('CommandLine=success.exe --test');
              }
            }
          });

          wmicChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return wmicChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute "continue;" when PID 1234 fails, so only PID 5678 should be returned
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('success.exe');
      expect(processes[0].command).toBe('success.exe --test');
    });

    it('should verify line 58 continue execution path with comprehensive error scenarios', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       9999
`;

      mockChildProcess.stdout.on.mockImplementation((event: any, callback: any) => {
        if (event === 'data') callback(netstatOutput);
      });

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'close') callback(0);
      });

      let tasklistCallCount = 0;
      mockSpawn.mockImplementation((command: any, args: any) => {
        if (command === 'netstat') {
          return mockChildProcess;
        } else if (command === 'tasklist') {
          tasklistCallCount++;
          const tasklistChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          if (tasklistCallCount === 1) {
            // First call (PID 1234) - simulate throwing error
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'error') {
                callback(new Error('Process access denied'));
              }
            });
          } else if (tasklistCallCount === 2) {
            // Second call (PID 5678) - simulate command execution error
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(1);
            });
            tasklistChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('Command failed');
            });
          } else {
            // Third call (PID 9999) - simulate success
            tasklistChild.on.mockImplementation((event: any, callback: any) => {
              if (event === 'close') callback(0);
            });

            tasklistChild.stdout.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('"working.exe","9999","Console","1","32,768 K"');
            });

            tasklistChild.stderr.on.mockImplementation((event: any, callback: any) => {
              if (event === 'data') callback('');
            });
          }

          return tasklistChild;
        } else if (command === 'wmic') {
          const wmicChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn(),
          };

          wmicChild.on.mockImplementation((event: any, callback: any) => {
            if (event === 'close') callback(0);
          });

          wmicChild.stdout.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') {
              if (args.includes('9999')) {
                callback('CommandLine=working.exe --success');
              }
            }
          });

          wmicChild.stderr.on.mockImplementation((event: any, callback: any) => {
            if (event === 'data') callback('');
          });

          return wmicChild;
        }
        return mockChildProcess;
      });

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute continue for both PID 1234 and 5678 errors, only PID 9999 succeeds
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(9999);
      expect(processes[0].name).toBe('working.exe');
      expect(processes[0].command).toBe('working.exe --success');
    });
  });
});
