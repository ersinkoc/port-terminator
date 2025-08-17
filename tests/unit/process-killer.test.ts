import { ProcessKiller } from '../../src/core/process-killer';
import { WindowsPlatform } from '../../src/platforms/windows';
import { MacOSPlatform } from '../../src/platforms/macos';
import { LinuxPlatform } from '../../src/platforms/linux';
import { PlatformError } from '../../src/errors';
import { IProcessInfo } from '../../src/types';

jest.mock('../../src/platforms/windows');
jest.mock('../../src/platforms/macos');
jest.mock('../../src/platforms/linux');
jest.mock('../../src/utils/platform');

const mockWindowsPlatform = WindowsPlatform as jest.MockedClass<typeof WindowsPlatform>;
const mockMacOSPlatform = MacOSPlatform as jest.MockedClass<typeof MacOSPlatform>;
const mockLinuxPlatform = LinuxPlatform as jest.MockedClass<typeof LinuxPlatform>;

describe('ProcessKiller', () => {
  let processKiller: ProcessKiller;
  let mockPlatformInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPlatformInstance = {
      findProcessesByPort: jest.fn(),
      killProcess: jest.fn(),
      isPortAvailable: jest.fn(),
    };

    const { getPlatform } = require('../../src/utils/platform');
    getPlatform.mockReturnValue('linux');

    mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);

    processKiller = new ProcessKiller();
  });

  describe('constructor', () => {
    it('should create Linux platform instance', () => {
      expect(mockLinuxPlatform).toHaveBeenCalled();
    });

    it('should create Windows platform instance (lines 16-17)', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('win32');

      mockWindowsPlatform.mockImplementation(() => mockPlatformInstance);

      const processKiller = new ProcessKiller();
      expect(mockWindowsPlatform).toHaveBeenCalled();
    });

    it('should create macOS platform instance (lines 18-20)', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('darwin');

      mockMacOSPlatform.mockImplementation(() => mockPlatformInstance);

      const processKiller = new ProcessKiller();
      expect(mockMacOSPlatform).toHaveBeenCalled();
    });

    it('should throw PlatformError for unsupported platform (line 25)', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('unsupported');

      expect(() => new ProcessKiller()).toThrow(PlatformError);
      expect(() => new ProcessKiller()).toThrow('unsupported');
    });
  });

  describe('killProcess', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should kill process gracefully first', async () => {
      mockPlatformInstance.killProcess.mockResolvedValueOnce(true);
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      const result = await processKiller.killProcess(1234, false, 1000);

      expect(result).toBe(true);
      expect(mockPlatformInstance.killProcess).toHaveBeenCalledWith(1234, false);
    });

    it('should force kill if graceful fails', async () => {
      mockPlatformInstance.killProcess
        .mockRejectedValueOnce(new Error('Graceful failed'))
        .mockResolvedValueOnce(true);

      const result = await processKiller.killProcess(1234, false, 1000);

      expect(result).toBe(true);
      expect(mockPlatformInstance.killProcess).toHaveBeenCalledWith(1234, false);
      expect(mockPlatformInstance.killProcess).toHaveBeenCalledWith(1234, true);
    });

    it('should force kill immediately when force is true', async () => {
      mockPlatformInstance.killProcess.mockResolvedValue(true);

      const result = await processKiller.killProcess(1234, true);

      expect(result).toBe(true);
      expect(mockPlatformInstance.killProcess).toHaveBeenCalledWith(1234, true);
    });

    it('should skip graceful timeout when gracefulTimeout is 0', async () => {
      mockPlatformInstance.killProcess.mockResolvedValue(true);

      const result = await processKiller.killProcess(1234, false, 0);

      expect(result).toBe(true);
      expect(mockPlatformInstance.killProcess).toHaveBeenCalledWith(1234, true);
    });
  });

  describe('killProcesses', () => {
    it('should kill multiple processes', async () => {
      mockPlatformInstance.killProcess.mockResolvedValue(true);
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      const result = await processKiller.killProcesses([1234, 5678]);

      expect(result.get(1234)).toBe(true);
      expect(result.get(5678)).toBe(true);
    });

    it('should handle individual process failures (line 55)', async () => {
      // Mock killProcess to succeed for first PID, fail for second
      processKiller.killProcess = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Kill failed'));

      const result = await processKiller.killProcesses([1234, 5678]);

      expect(result.get(1234)).toBe(true);
      expect(result.get(5678)).toBe(false);
    });
  });

  describe('killProcessesByPort', () => {
    const mockProcesses: IProcessInfo[] = [
      { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
    ];

    it('should kill all processes on a port', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);
      // Mock killProcess to succeed for both processes
      processKiller.killProcess = jest.fn().mockResolvedValue(true);

      const result = await processKiller.killProcessesByPort(3000);

      expect(result).toEqual(mockProcesses);
      expect(processKiller.killProcess).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no processes found', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      const result = await processKiller.killProcessesByPort(3000);

      expect(result).toEqual([]);
      expect(mockPlatformInstance.killProcess).not.toHaveBeenCalled();
    });

    it('should continue with other processes if one fails', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);
      // Mock killProcess to fail for first process, succeed for second
      processKiller.killProcess = jest
        .fn()
        .mockRejectedValueOnce(new Error('Kill failed'))
        .mockResolvedValueOnce(true);

      const result = await processKiller.killProcessesByPort(3000);

      expect(result).toEqual([mockProcesses[1]]);
      expect(processKiller.killProcess).toHaveBeenCalledTimes(2);
    });
  });

  describe('killProcessesByPorts', () => {
    it('should kill processes on multiple ports', async () => {
      const mockProcesses3000: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];
      const mockProcesses8080: IProcessInfo[] = [
        { pid: 5678, name: 'nginx', port: 8080, protocol: 'tcp' },
      ];

      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce(mockProcesses8080);
      mockPlatformInstance.killProcess.mockResolvedValue(true);

      const result = await processKiller.killProcessesByPorts([3000, 8080]);

      expect(result.get(3000)).toEqual(mockProcesses3000);
      expect(result.get(8080)).toEqual(mockProcesses8080);
    });

    it('should handle errors for individual ports', async () => {
      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Find failed'));

      const result = await processKiller.killProcessesByPorts([3000, 8080]);

      expect(result.get(3000)).toEqual([]);
      expect(result.get(8080)).toEqual([]);
    });
  });

  describe('waitForProcessToExit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait and return true when process exits (line 126)', async () => {
      const waitForProcessToExit = (processKiller as any).waitForProcessToExit;

      // Mock Date.now to control timing but stay within timeout
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        // Stay within timeout to ensure we go through the setTimeout (line 126)
        return callCount * 50; // 0ms, 50ms, 100ms etc - all within timeout
      });

      // Mock findProcessesByPort(0) to return process first, then empty (process exits)
      let findCallCount = 0;
      mockPlatformInstance.findProcessesByPort.mockImplementation((port) => {
        if (port === 0) {
          findCallCount++;
          if (findCallCount === 1) {
            return Promise.resolve([{ pid: 1234, name: 'test', port: 3000, protocol: 'tcp' }]);
          }
          return Promise.resolve([]); // Process exits on second call
        }
        return Promise.resolve([]);
      });

      const promise = waitForProcessToExit(1234, 1000);

      // Advance time to trigger the setTimeout call (line 126) and allow second check
      jest.advanceTimersByTime(150);

      const result = await promise;
      expect(result).toBe(true);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should return true when findProcessesByPort throws error (line 128)', async () => {
      const waitForProcessToExit = (processKiller as any).waitForProcessToExit;

      // Mock findProcessesByPort to throw an error
      mockPlatformInstance.findProcessesByPort.mockRejectedValue(new Error('Process check failed'));

      const result = await waitForProcessToExit(1234, 1000);
      expect(result).toBe(true);
    });

    it('should execute setTimeout and continue loop to cover line 126', async () => {
      // Use real timers so setTimeout actually runs
      jest.useRealTimers();

      const waitForProcessToExit = (processKiller as any).waitForProcessToExit.bind(processKiller);

      // Create a fresh processKiller instance for this test
      const testProcessKiller = new ProcessKiller();
      const testWaitForProcessToExit = (testProcessKiller as any).waitForProcessToExit.bind(
        testProcessKiller
      );

      // Set up the platform mock directly on the test instance
      const testPlatformInstance = {
        findProcessesByPort: jest.fn(),
        killProcess: jest.fn(),
        isPortAvailable: jest.fn(),
      };

      (testProcessKiller as any).platform = testPlatformInstance;

      // Mock Date.now for predictable timing
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount * 50; // 50ms, 100ms increments - stay within timeout
      });

      // Set up findProcessesByPort to return process first time, empty second time
      let findCallCount = 0;
      testPlatformInstance.findProcessesByPort.mockImplementation(async (port) => {
        if (port === 0) {
          findCallCount++;
          if (findCallCount === 1) {
            // First call: process exists - this will lead to setTimeout
            return [{ pid: 1234, name: 'test', port: 3000, protocol: 'tcp' }];
          } else {
            // Second call after setTimeout: process gone
            return [];
          }
        }
        return [];
      });

      const result = await testWaitForProcessToExit(1234, 5000);
      expect(result).toBe(true);

      // Should have called findProcessesByPort twice
      expect(testPlatformInstance.findProcessesByPort).toHaveBeenCalledTimes(2);

      // Restore
      Date.now = originalDateNow;
      jest.useFakeTimers();
    });

    it('should timeout and return false when process never exits (line 132)', async () => {
      const waitForProcessToExit = (processKiller as any).waitForProcessToExit;

      // Mock Date.now to simulate time progression and trigger timeout
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        // First call (startTime): 0ms
        // Second call (loop check): 500ms (exceeds 200ms timeout)
        return callCount === 1 ? 0 : 500;
      });

      // Mock findProcessesByPort(0) to always return the process (never exits)
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([
        { pid: 1234, name: 'test', port: 3000, protocol: 'tcp' },
      ]);

      const result = await waitForProcessToExit(1234, 200);
      expect(result).toBe(false);

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });
});
