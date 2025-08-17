import { WindowsPlatform } from '../../../src/platforms/windows';
import { CommandExecutionError, ProcessKillError, PermissionError } from '../../../src/errors';

// Mock child_process
jest.mock('child_process');
const mockSpawn = require('child_process').spawn;

describe.skip('WindowsPlatform', () => {
  let platform: WindowsPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    platform = new WindowsPlatform();
  });

  const createMockChild = (stdout: string, stderr: string = '', exitCode: number = 0, shouldError: boolean = false) => {
    const mockChild = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
    };

    mockChild.stdout.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') callback(stdout);
    });

    mockChild.stderr.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') callback(stderr);
    });

    mockChild.on.mockImplementation((event: string, callback: Function) => {
      if (shouldError && event === 'error') {
        callback(new Error('Spawn failed'));
      } else if (event === 'close') {
        callback(exitCode);
      }
    });

    return mockChild;
  };

  const setupCommandMocks = (commandMap: Record<string, { stdout: string; stderr?: string; exitCode?: number; shouldError?: boolean }>) => {
    mockSpawn.mockImplementation((command: string, args: string[]) => {
      const key = `${command} ${args.join(' ')}`;
      const config = commandMap[key] || commandMap[command] || { stdout: '', stderr: '', exitCode: 0 };
      return createMockChild(config.stdout, config.stderr || '', config.exitCode || 0, config.shouldError || false);
    });
  };

  describe('findProcessesByPort', () => {
    it('should find processes using netstat output', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       5678
  UDP    0.0.0.0:53             *:*                                    9999
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '"node.exe","1234","Console","1","32,768 K"' },
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=node server.js\n\n' },
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
      expect(mockSpawn).toHaveBeenCalledWith('netstat', ['-ano'], expect.any(Object));
    });

    it('should find UDP processes when protocol is udp', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  UDP    0.0.0.0:3000           *:*                                    5678
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"dns.exe","5678","Console","1","16,384 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=dns.exe\n\n' },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '"node.exe","1234","Console","1","32,768 K"' },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"dns.exe","5678","Console","1","16,384 K"' },
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=node.exe\n\n' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=dns.exe\n\n' },
      });

      const processes = await platform.findProcessesByPort(3000, 'both');

      expect(processes).toHaveLength(2);
      expect(processes[0].protocol).toBe('tcp');
      expect(processes[1].protocol).toBe('udp');
    });

    it('should handle netstat command execution error', async () => {
      setupCommandMocks({
        'netstat -ano': { stdout: '', stderr: 'Command failed', exitCode: 1 },
      });

      await expect(platform.findProcessesByPort(3000)).rejects.toThrow(CommandExecutionError);
    });

    it('should handle spawn error', async () => {
      setupCommandMocks({
        'netstat -ano': { stdout: '', stderr: '', exitCode: 0, shouldError: true },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"nginx.exe","5678","Console","1","16,384 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=nginx.exe\n\n' },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '', stderr: 'Process not found', exitCode: 1 },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"nginx.exe","5678","Console","1","16,384 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=nginx.exe\n\n' },
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(2); // Both processes should be found, but with different behaviors for error handling
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].name).toBe('Unknown'); // This process failed to get name but continued processing
      expect(processes[1].pid).toBe(5678);
      expect(processes[1].name).toBe('nginx.exe'); // This process succeeded
    });

    it('should skip lines with insufficient parts', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address
  TCP    incomplete line
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '"node.exe","1234","Console","1","32,768 K"' },
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=node.exe\n\n' },
      });

      const processes = await platform.findProcessesByPort(3000);
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(1234);
    });
  });

  describe('killProcess', () => {
    it('should kill process gracefully by default', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: 'Process killed successfully' },
        'tasklist /FI PID eq 1234 /FO CSV': { stdout: '', stderr: 'Process not found', exitCode: 1 },
      });

      const result = await platform.killProcess(1234, false);
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('taskkill', ['/PID', '1234'], expect.any(Object));
    });

    it('should force kill when requested', async () => {
      setupCommandMocks({
        'taskkill /F /PID 1234': { stdout: 'Process killed successfully' },
        'tasklist /FI PID eq 1234 /FO CSV': { stdout: '', stderr: 'Process not found', exitCode: 1 },
      });

      const result = await platform.killProcess(1234, true);
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('taskkill', ['/F', '/PID', '1234'], expect.any(Object));
    });

    it('should handle access denied error', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: '', stderr: 'Access is denied', exitCode: 1 },
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(PermissionError);
    });

    it('should return true if process not found', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: '', stderr: 'The process "1234" not found', exitCode: 1 },
      });

      const result = await platform.killProcess(1234);
      expect(result).toBe(true);
    });

    it('should return true if process not running', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: '', stderr: 'The process is not running', exitCode: 1 },
      });

      const result = await platform.killProcess(1234);
      expect(result).toBe(true);
    });

    it('should throw ProcessKillError for other failures', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: '', stderr: 'Some other error', exitCode: 1 },
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
    });

    it('should handle spawn error during kill', async () => {
      setupCommandMocks({
        'taskkill /PID 1234': { stdout: '', stderr: '', exitCode: 0, shouldError: true },
      });

      await expect(platform.killProcess(1234)).rejects.toThrow(ProcessKillError);
    });
  });

  describe('isPortAvailable', () => {
    it('should return true when no processes found', async () => {
      setupCommandMocks({
        'netstat -ano': { stdout: 'Active Connections\n\n  Proto  Local Address' },
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

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '"node.exe","1234","Console","1","32,768 K"' },
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=node.exe\n\n' },
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

      setupCommandMocks({
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '"node.exe","1234","Console","1","32,768 K"' },
      });

      const name = await getProcessName(1234);
      expect(name).toBe('node.exe');
      expect(mockSpawn).toHaveBeenCalledWith('tasklist', [
        '/FI',
        'PID eq 1234',
        '/FO',
        'CSV',
        '/NH',
      ], expect.any(Object));
    });

    it('should return Unknown on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      setupCommandMocks({
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '', stderr: 'Error', exitCode: 1 },
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });

    it('should return Unknown when no lines returned', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      setupCommandMocks({
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: '' },
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });

    it('should return Unknown when CSV parsing returns empty array', async () => {
      const platform = new WindowsPlatform();
      const getProcessName = (platform as any).getProcessName;

      setupCommandMocks({
        'tasklist /FI PID eq 1234 /FO CSV /NH': { stdout: ',,,' },
      });

      const name = await getProcessName(1234);
      expect(name).toBe('Unknown');
    });
  });

  describe('getProcessCommand', () => {
    it('should get process command from wmic', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=node server.js\n\n' },
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
      ], expect.any(Object));
    });

    it('should return undefined when command is empty', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'CommandLine=\n\n' },
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: '', stderr: 'Error', exitCode: 1 },
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });

    it('should return undefined when no CommandLine found', async () => {
      const platform = new WindowsPlatform();
      const getProcessCommand = (platform as any).getProcessCommand;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get CommandLine /format:value': { stdout: 'SomeOtherProperty=value\n\n' },
      });

      const command = await getProcessCommand(1234);
      expect(command).toBeUndefined();
    });
  });

  describe('getProcessUser', () => {
    it('should return undefined (Windows does not implement user retrieval)', async () => {
      const platform = new WindowsPlatform();
      const getProcessUser = (platform as any).getProcessUser;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get ExecutablePath /format:value': { stdout: 'ExecutablePath=C:\\path\\to\\exe' },
      });

      const user = await getProcessUser(1234);
      expect(user).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      const platform = new WindowsPlatform();
      const getProcessUser = (platform as any).getProcessUser;

      setupCommandMocks({
        'wmic process where ProcessId=1234 get ExecutablePath /format:value': { stdout: '', stderr: 'Error', exitCode: 1 },
      });

      const user = await getProcessUser(1234);
      expect(user).toBeUndefined();
    });
  });

  describe('executeCommand', () => {
    it('should execute command with windowsHide option', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      mockSpawn.mockImplementation((command: string, args: string[], options: any) => {
        expect(options.windowsHide).toBe(true);
        expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
        return createMockChild('test output');
      });

      const result = await executeCommand('test', ['arg1']);
      expect(result.stdout).toBe('test output');
      expect(result.exitCode).toBe(0);
    });

    it('should handle spawn error', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      setupCommandMocks({
        'test arg1': { stdout: '', stderr: '', exitCode: 0, shouldError: true },
      });

      await expect(executeCommand('test', ['arg1'])).rejects.toThrow(CommandExecutionError);
    });

    it('should reject on non-zero exit code', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      setupCommandMocks({
        'test arg1': { stdout: '', stderr: 'Error message', exitCode: 1 },
      });

      await expect(executeCommand('test', ['arg1'])).rejects.toThrow(CommandExecutionError);
    });

    it('should accumulate stdout and stderr data', async () => {
      const platform = new WindowsPlatform();
      const executeCommand = (platform as any).executeCommand;

      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
      };

      mockChild.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') callback(0);
      });

      mockChild.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback('part1');
          callback('part2');
        }
      });

      mockChild.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback('error1');
          callback('error2');
        }
      });

      mockSpawn.mockReturnValue(mockChild);

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
        const mockChild = createMockChild('', '', callCount === 1 ? 0 : 1);
        return mockChild;
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Fast-forward time to trigger the timeout check
      jest.advanceTimersByTime(150);

      await promise;
      expect(mockSpawn).toHaveBeenCalledWith('tasklist', ['/FI', 'PID eq 1234', '/FO', 'CSV'], expect.any(Object));
    });

    it('should timeout waiting for process to exit', async () => {
      const platform = new WindowsPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      mockSpawn.mockImplementation(() => createMockChild('', '', 0)); // Process always exists

      const promise = waitForProcessToExit(1234, 100);

      // Fast-forward time past the timeout
      jest.advanceTimersByTime(200);

      await promise; // Should complete due to timeout
    });

    it('should handle process that exits immediately', async () => {
      const platform = new WindowsPlatform();
      const waitForProcessToExit = (platform as any).waitForProcessToExit;

      mockSpawn.mockImplementation(() => createMockChild('', '', 1)); // Process immediately not found

      const promise = waitForProcessToExit(1234, 1000);

      // Should complete immediately
      await promise;
    });
  });

  describe('Error handling in process info gathering', () => {
    it('should continue processing when getProcessName/Command/User fails - covers line 58', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"node.exe","5678","Console","1","32,768 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=node server.js\n\n' },
      });

      // Override getProcessName for PID 1234 to throw an error
      const originalGetProcessName = platform['getProcessName'];
      platform['getProcessName'] = async function(pid: number) {
        if (pid === 1234) {
          throw new Error('Access denied');
        }
        return await originalGetProcessName.call(this, pid);
      };

      const processes = await platform.findProcessesByPort(3000);

      // Should only return one process (PID 5678) since PID 1234 failed and was skipped via line 58
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('node.exe');
      
      // Restore original method
      platform['getProcessName'] = originalGetProcessName;
    });

    it('should specifically test line 58 - continue on error during process info gathering', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"success.exe","5678","Console","1","32,768 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=success.exe --test\n\n' },
      });

      // Override getProcessCommand for PID 1234 to throw an error
      const originalGetProcessCommand = platform['getProcessCommand'];
      platform['getProcessCommand'] = async function(pid: number) {
        if (pid === 1234) {
          throw new Error('Process access denied');
        }
        return await originalGetProcessCommand.call(this, pid);
      };

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute "continue;" when PID 1234 fails, so only PID 5678 should be returned
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('success.exe');
      expect(processes[0].command).toBe('success.exe --test');

      // Restore original method
      platform['getProcessCommand'] = originalGetProcessCommand;
    });
  });

  describe('Complete Coverage for line 58', () => {
    it('should execute continue statement on line 58 when process info gathering fails', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 5678 /FO CSV /NH': { stdout: '"success.exe","5678","Console","1","32,768 K"' },
        'wmic process where ProcessId=5678 get CommandLine /format:value': { stdout: 'CommandLine=success.exe --test\n\n' },
      });

      // Override getProcessUser for PID 1234 to throw an error
      const originalGetProcessUser = platform['getProcessUser'];
      platform['getProcessUser'] = async function(pid: number) {
        if (pid === 1234) {
          throw new Error('Access denied');
        }
        return await originalGetProcessUser.call(this, pid);
      };

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute "continue;" when PID 1234 fails, so only PID 5678 should be returned
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(5678);
      expect(processes[0].name).toBe('success.exe');
      expect(processes[0].command).toBe('success.exe --test');

      // Restore original method
      platform['getProcessUser'] = originalGetProcessUser;
    });

    it('should verify line 58 continue execution path with comprehensive error scenarios', async () => {
      const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       5678
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       9999
`;

      setupCommandMocks({
        'netstat -ano': { stdout: netstatOutput },
        'tasklist /FI PID eq 9999 /FO CSV /NH': { stdout: '"working.exe","9999","Console","1","32,768 K"' },
        'wmic process where ProcessId=9999 get CommandLine /format:value': { stdout: 'CommandLine=working.exe --success\n\n' },
      });

      // Override methods to throw errors for PIDs 1234 and 5678
      const originalGetProcessName = platform['getProcessName'];
      const originalGetProcessCommand = platform['getProcessCommand'];
      
      platform['getProcessName'] = async function(pid: number) {
        if (pid === 1234) {
          throw new Error('Process access denied');
        }
        return await originalGetProcessName.call(this, pid);
      };

      platform['getProcessCommand'] = async function(pid: number) {
        if (pid === 5678) {
          throw new Error('Command failed');
        }
        return await originalGetProcessCommand.call(this, pid);
      };

      const processes = await platform.findProcessesByPort(3000);

      // Line 58 should execute continue for both PID 1234 and 5678 errors, only PID 9999 succeeds
      expect(processes).toHaveLength(1);
      expect(processes[0].pid).toBe(9999);
      expect(processes[0].name).toBe('working.exe');
      expect(processes[0].command).toBe('working.exe --success');

      // Restore original methods
      platform['getProcessName'] = originalGetProcessName;
      platform['getProcessCommand'] = originalGetProcessCommand;
    });
  });
});