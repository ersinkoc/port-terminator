import { ProcessFinder } from '../../../src/core/process-finder';
import { LinuxPlatform } from '../../../src/platforms/linux';
import { MacOSPlatform } from '../../../src/platforms/macos';
import { WindowsPlatform } from '../../../src/platforms/windows';
import { PlatformError } from '../../../src/errors';
import { IProcessInfo } from '../../../src/types';

// Mock platform implementations
jest.mock('../../../src/platforms/linux');
jest.mock('../../../src/platforms/macos');
jest.mock('../../../src/platforms/windows');
jest.mock('../../../src/utils/platform');

const mockLinuxPlatform = LinuxPlatform as jest.MockedClass<typeof LinuxPlatform>;
const mockMacOSPlatform = MacOSPlatform as jest.MockedClass<typeof MacOSPlatform>;
const mockWindowsPlatform = WindowsPlatform as jest.MockedClass<typeof WindowsPlatform>;

describe('ProcessFinder', () => {
  let mockPlatformInstance: any;
  let processFinder: ProcessFinder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPlatformInstance = {
      findProcessesByPort: jest.fn(),
      killProcess: jest.fn(),
      isPortAvailable: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should create Windows platform instance', () => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('win32');
      mockWindowsPlatform.mockImplementation(() => mockPlatformInstance);

      processFinder = new ProcessFinder();

      expect(mockWindowsPlatform).toHaveBeenCalled();
    });

    it('should create macOS platform instance', () => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('darwin');
      mockMacOSPlatform.mockImplementation(() => mockPlatformInstance);

      processFinder = new ProcessFinder();

      expect(mockMacOSPlatform).toHaveBeenCalled();
    });

    it('should create Linux platform instance', () => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);

      processFinder = new ProcessFinder();

      expect(mockLinuxPlatform).toHaveBeenCalled();
    });

    it('should throw PlatformError for unsupported platform', () => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockImplementation(() => {
        throw new PlatformError('unsupported');
      });

      expect(() => new ProcessFinder()).toThrow(PlatformError);
    });
  });

  describe('findByPort', () => {
    beforeEach(() => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    it('should find processes on a port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
        { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp', user: 'root' },
      ];

      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPort(3000);

      expect(result).toEqual(mockProcesses);
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(3000, undefined);
    });

    it('should find processes with specific protocol', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
      ];

      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPort(3000, 'tcp');

      expect(result).toEqual(mockProcesses);
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(3000, 'tcp');
    });

    it('should return empty array when no processes found', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      const result = await processFinder.findByPort(3000);

      expect(result).toEqual([]);
    });

    it('should propagate platform errors', async () => {
      const error = new Error('Platform error');
      mockPlatformInstance.findProcessesByPort.mockRejectedValue(error);

      await expect(processFinder.findByPort(3000)).rejects.toThrow('Platform error');
    });

    it('should handle different port numbers', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      await processFinder.findByPort(8080);
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(8080, undefined);

      await processFinder.findByPort(443, 'tcp');
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(443, 'tcp');
    });

    it('should handle different protocols', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      await processFinder.findByPort(53, 'udp');
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(53, 'udp');

      await processFinder.findByPort(80, 'both');
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(80, 'both');
    });
  });

  describe('findByPorts', () => {
    beforeEach(() => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    it('should find processes on multiple ports', async () => {
      const mockProcesses3000: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
      ];
      const mockProcesses8080: IProcessInfo[] = [
        { pid: 5678, name: 'nginx', port: 8080, protocol: 'tcp', user: 'root' },
      ];

      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce(mockProcesses8080);

      const result = await processFinder.findByPorts([3000, 8080]);

      expect(result.size).toBe(2);
      expect(result.get(3000)).toEqual(mockProcesses3000);
      expect(result.get(8080)).toEqual(mockProcesses8080);
    });

    it('should handle empty ports array', async () => {
      const result = await processFinder.findByPorts([]);

      expect(result.size).toBe(0);
      expect(mockPlatformInstance.findProcessesByPort).not.toHaveBeenCalled();
    });

    it('should handle single port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
      ];

      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPorts([3000]);

      expect(result.size).toBe(1);
      expect(result.get(3000)).toEqual(mockProcesses);
    });

    it('should handle errors for individual ports', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
      ];

      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce(mockProcesses)
        .mockRejectedValueOnce(new Error('Port scan failed'));

      const result = await processFinder.findByPorts([3000, 8080]);

      expect(result.size).toBe(2);
      expect(result.get(3000)).toEqual(mockProcesses);
      expect(result.get(8080)).toEqual([]); // Error results in empty array
    });

    it('should pass protocol to underlying calls', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue([]);

      await processFinder.findByPorts([3000, 8080], 'tcp');

      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(3000, 'tcp');
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(8080, 'tcp');
    });

    it('should handle concurrent port scanning', async () => {
      // Simulate slow responses
      let resolveCallbacks: Array<(value: IProcessInfo[]) => void> = [];
      mockPlatformInstance.findProcessesByPort.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveCallbacks.push(resolve);
        });
      });

      const resultPromise = processFinder.findByPorts([3000, 8080, 9000]);

      // All calls should be made immediately (concurrently)
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledTimes(3);

      // Resolve in reverse order to test concurrency
      resolveCallbacks[2]([{ pid: 9999, name: 'test3', port: 9000, protocol: 'tcp' }]);
      resolveCallbacks[0]([{ pid: 1111, name: 'test1', port: 3000, protocol: 'tcp' }]);
      resolveCallbacks[1]([{ pid: 2222, name: 'test2', port: 8080, protocol: 'tcp' }]);

      const result = await resultPromise;

      expect(result.size).toBe(3);
      expect(result.get(3000)?.[0].pid).toBe(1111);
      expect(result.get(8080)?.[0].pid).toBe(2222);
      expect(result.get(9000)?.[0].pid).toBe(9999);
    });

    it('should handle duplicate ports', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp', user: 'user' },
      ];

      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPorts([3000, 3000]);

      expect(result.size).toBe(1); // Map deduplicates
      expect(result.get(3000)).toEqual(mockProcesses);
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledTimes(2); // But calls are still made
    });
  });

  describe('isPortAvailable', () => {
    beforeEach(() => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    it('should check if port is available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const result = await processFinder.isPortAvailable(3000);

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, undefined);
    });

    it('should check if port is not available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const result = await processFinder.isPortAvailable(3000);

      expect(result).toBe(false);
    });

    it('should check port availability with protocol', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const result = await processFinder.isPortAvailable(3000, 'tcp');

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, 'tcp');
    });

    it('should propagate platform errors', async () => {
      const error = new Error('Platform check failed');
      mockPlatformInstance.isPortAvailable.mockRejectedValue(error);

      await expect(processFinder.isPortAvailable(3000)).rejects.toThrow('Platform check failed');
    });

    it('should handle different protocols', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      await processFinder.isPortAvailable(53, 'udp');
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(53, 'udp');

      await processFinder.isPortAvailable(80, 'both');
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(80, 'both');
    });
  });

  describe('waitForPortToBeAvailable', () => {
    let mockPlatformInstance: any; // Redefine locally

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers({ advanceTimers: true, timerLimit: 20000 });

      mockPlatformInstance = {
        findProcessesByPort: jest.fn(),
        killProcess: jest.fn(),
        isPortAvailable: jest.fn().mockResolvedValue(true),
      };

      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true immediately if port is available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const promise = processFinder.waitForPortToBeAvailable(3000, 5000);
      const result = await promise;

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(1);
    });

    it('should wait and return true when port becomes available', async () => {
      mockPlatformInstance.isPortAvailable
        .mockResolvedValueOnce(false) // First check: not busy (available)
        .mockResolvedValueOnce(false) // Second check: not busy (available)
        .mockResolvedValueOnce(true); // Third check: available

      const promise = processFinder.waitForPortToBeAvailable(3000, 5000);

      // Advance timers to trigger checks
      jest.advanceTimersByTime(250); // Trigger first check
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(250); // Trigger second check
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(250); // Trigger third check
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(3);
    });

    it('should return false when timeout is reached', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      // Fast-forward past timeout
      jest.advanceTimersByTime(1000); // Advance exactly to timeout
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(4); // 1000ms / 250ms interval + 1 initial check
    });

    it('should use default timeout when not specified', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const promise = processFinder.waitForPortToBeAvailable(3000);

      // Fast-forward to near default timeout (30000ms)
      jest.advanceTimersByTime(29000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      // Should still be checking
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(121); // 30000/250 + 1

      // Complete timeout
      jest.advanceTimersByTime(250); // Advance one more interval to hit timeout exactly
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should pass protocol to platform calls', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      await processFinder.waitForPortToBeAvailable(3000, 1000, 'tcp');

      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, 'tcp');
    });

    it('should handle platform errors gracefully', async () => {
      mockPlatformInstance.isPortAvailable
        .mockRejectedValueOnce(new Error('Platform error'))
        .mockResolvedValue(true);

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(2);
    });

    it('should use correct check interval', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      // Advance by exact intervals and check call count
      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(2); // Initial + 1 interval

      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(3); // + 1 more

      jest.advanceTimersByTime(500); // Skip to timeout
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await promise;
    });

    it('should handle zero timeout', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const result = await processFinder.waitForPortToBeAvailable(3000, 0);

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(1); // Should be called once
    });
  });

  describe('waitForPortToBeBusy', () => {
    let mockPlatformInstance: any; // Redefine locally

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers({ advanceTimers: true, timerLimit: 20000 });

      mockPlatformInstance = {
        findProcessesByPort: jest.fn(),
        killProcess: jest.fn(),
        isPortAvailable: jest.fn().mockResolvedValue(false), // Initially busy
      };

      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true immediately if port is busy', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false); // false = busy

      const result = await processFinder.waitForPortToBeBusy(3000, 5000);

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(1);
    });

    it('should wait and return true when port becomes busy', async () => {
      mockPlatformInstance.isPortAvailable
        .mockResolvedValueOnce(true) // First check: not busy (available)
        .mockResolvedValueOnce(true) // Second check: not busy (available)
        .mockResolvedValueOnce(false); // Third check: busy (not available)

      const promise = processFinder.waitForPortToBeBusy(3000, 5000);

      // Fast-forward through multiple check intervals
      jest.advanceTimersByTime(250); // First check
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(250); // Second check
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      jest.advanceTimersByTime(250); // Third check - should succeed
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(3);
    });

    it('should return false when timeout is reached', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true); // Always available

      const promise = processFinder.waitForPortToBeBusy(3000, 1000);

      // Fast-forward past timeout
      jest.advanceTimersByTime(1000); // Advance exactly to timeout
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(5); // 1000ms / 250ms interval + 1 initial check
    });

    it('should use default timeout when not specified', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const promise = processFinder.waitForPortToBeBusy(3000);

      // Fast-forward to near default timeout (30000ms)
      jest.advanceTimersByTime(29000);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      // Should still be checking
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(121); // 30000/250 + 1

      // Complete timeout
      jest.advanceTimersByTime(250); // Advance one more interval to hit timeout exactly
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should pass protocol to platform calls', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      await processFinder.waitForPortToBeBusy(3000, 1000, 'udp');

      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, 'udp');
    });

    it('should handle platform errors gracefully', async () => {
      mockPlatformInstance.isPortAvailable
        .mockRejectedValueOnce(new Error('Platform error'))
        .mockResolvedValue(true); // Busy

      const promise = processFinder.waitForPortToBeBusy(3000, 1000);

      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(2);
    });

    it('should use correct check interval', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const promise = processFinder.waitForPortToBeBusy(3000, 1000);

      // Advance by exact intervals and check call count
      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(2); // Initial + 1 interval

      jest.advanceTimersByTime(250);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(3); // + 1 more

      jest.advanceTimersByTime(500); // Skip to timeout
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      await promise;
    });

    it('should handle zero timeout', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true); // Port is available (not busy)

      const result = await processFinder.waitForPortToBeBusy(3000, 0);

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(1); // Should be called once
    });
  });

  describe('platform selection', () => {
    it('should select correct platform based on OS', () => {
      const { getPlatform } = require('../../../src/utils/platform');

      // Test Windows
      getPlatform.mockReturnValue('win32');
      mockWindowsPlatform.mockImplementation(() => mockPlatformInstance);
      new ProcessFinder();
      expect(mockWindowsPlatform).toHaveBeenCalled();

      jest.clearAllMocks();

      // Test macOS
      getPlatform.mockReturnValue('darwin');
      mockMacOSPlatform.mockImplementation(() => mockPlatformInstance);
      new ProcessFinder();
      expect(mockMacOSPlatform).toHaveBeenCalled();

      jest.clearAllMocks();

      // Test Linux
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      new ProcessFinder();
      expect(mockLinuxPlatform).toHaveBeenCalled();
    });

    it('should handle platform creation errors', () => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('win32');
      mockWindowsPlatform.mockImplementation(() => {
        throw new Error('Platform creation failed');
      });

      expect(() => new ProcessFinder()).toThrow('Platform creation failed');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    it('should handle complex process finding scenarios', async () => {
      const mockProcesses: IProcessInfo[] = [
        {
          pid: 1234,
          name: 'node',
          port: 3000,
          protocol: 'tcp',
          user: 'user',
          command: 'node server.js',
        },
        {
          pid: 5678,
          name: 'nginx',
          port: 3000,
          protocol: 'tcp',
          user: 'root',
          command: 'nginx: master process',
        },
      ];

      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPort(3000, 'tcp');

      expect(result).toHaveLength(2);
      expect(result[0].command).toBe('node server.js');
      expect(result[1].user).toBe('root');
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce([{ pid: 1234, name: 'node', port: 3000, protocol: 'tcp' }])
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce([]);

      const result = await processFinder.findByPorts([3000, 8080, 9000]);

      expect(result.size).toBe(3);
      expect(result.get(3000)).toHaveLength(1);
      expect(result.get(8080)).toEqual([]); // Error case
      expect(result.get(9000)).toEqual([]); // No processes
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      const { getPlatform } = require('../../../src/utils/platform');
      getPlatform.mockReturnValue('linux');
      mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);
      processFinder = new ProcessFinder();
    });

    it('should propagate platform-specific errors', async () => {
      const platformError = new Error('lsof command failed');
      mockPlatformInstance.findProcessesByPort.mockRejectedValue(platformError);

      await expect(processFinder.findByPort(3000)).rejects.toThrow('lsof command failed');
    });

    it('should handle timeout errors in waiting functions', async () => {
      jest.useFakeTimers();
      mockPlatformInstance.isPortAvailable.mockImplementation(() => {
        return Promise.reject(new Error('Platform error'));
      });

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      jest.advanceTimersByTime(1200);
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      const result = await promise;
      expect(result).toBe(false); // Should timeout, not throw

      jest.useRealTimers();
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledTimes(2);
    });

    it('should handle async platform errors in bulk operations', async () => {
      mockPlatformInstance.findProcessesByPort.mockImplementation((port: number) => {
        if (port === 8080) {
          return Promise.reject(new Error(`Access denied for port ${port}`));
        }
        return Promise.resolve([]);
      });

      const result = await processFinder.findByPorts([3000, 8080, 9000]);

      expect(result.size).toBe(3);
      expect(result.get(3000)).toEqual([]);
      expect(result.get(8080)).toEqual([]); // Error handled gracefully
      expect(result.get(9000)).toEqual([]);
    });
  });
});
