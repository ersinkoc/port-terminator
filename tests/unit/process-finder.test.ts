import { ProcessFinder } from '../../src/core/process-finder';
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

describe('ProcessFinder', () => {
  let processFinder: ProcessFinder;
  let mockPlatformInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPlatformInstance = {
      findProcessesByPort: jest.fn(),
      isPortAvailable: jest.fn(),
      killProcess: jest.fn(),
    };

    const { getPlatform } = require('../../src/utils/platform');
    getPlatform.mockReturnValue('linux');

    mockLinuxPlatform.mockImplementation(() => mockPlatformInstance);

    processFinder = new ProcessFinder();
  });

  describe('constructor', () => {
    it('should create Windows platform on win32', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('win32');

      new ProcessFinder();

      expect(mockWindowsPlatform).toHaveBeenCalled();
    });

    it('should create macOS platform on darwin', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('darwin');

      new ProcessFinder();

      expect(mockMacOSPlatform).toHaveBeenCalled();
    });

    it('should create Linux platform on linux', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockReturnValue('linux');

      new ProcessFinder();

      expect(mockLinuxPlatform).toHaveBeenCalled();
    });

    it('should throw PlatformError for unsupported platform', () => {
      const { getPlatform } = require('../../src/utils/platform');
      getPlatform.mockImplementation(() => {
        throw new PlatformError('unsupported');
      });

      expect(() => new ProcessFinder()).toThrow(PlatformError);
    });
  });

  describe('findByPort', () => {
    const mockProcesses: IProcessInfo[] = [
      {
        pid: 1234,
        name: 'node',
        port: 3000,
        protocol: 'tcp',
        command: 'node server.js',
        user: 'testuser',
      },
    ];

    it('should find processes by port', async () => {
      mockPlatformInstance.findProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await processFinder.findByPort(3000);

      expect(result).toEqual(mockProcesses);
      expect(mockPlatformInstance.findProcessesByPort).toHaveBeenCalledWith(3000, undefined);
    });

    it('should find processes by port with protocol', async () => {
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

    it('should handle platform errors', async () => {
      const error = new Error('Platform error');
      mockPlatformInstance.findProcessesByPort.mockRejectedValue(error);

      await expect(processFinder.findByPort(3000)).rejects.toThrow('Platform error');
    });
  });

  describe('findByPorts', () => {
    it('should find processes for multiple ports', async () => {
      const mockProcesses1: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];
      const mockProcesses2: IProcessInfo[] = [
        { pid: 5678, name: 'nginx', port: 8080, protocol: 'tcp' },
      ];

      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce(mockProcesses1)
        .mockResolvedValueOnce(mockProcesses2);

      const result = await processFinder.findByPorts([3000, 8080]);

      expect(result.get(3000)).toEqual(mockProcesses1);
      expect(result.get(8080)).toEqual(mockProcesses2);
    });

    it('should handle errors for individual ports', async () => {
      mockPlatformInstance.findProcessesByPort
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Error'));

      const result = await processFinder.findByPorts([3000, 8080]);

      expect(result.get(3000)).toEqual([]);
      expect(result.get(8080)).toEqual([]);
    });
  });

  describe('isPortAvailable', () => {
    it('should check if port is available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const result = await processFinder.isPortAvailable(3000);

      expect(result).toBe(true);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, undefined);
    });

    it('should check if port is available with protocol', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const result = await processFinder.isPortAvailable(3000, 'tcp');

      expect(result).toBe(false);
      expect(mockPlatformInstance.isPortAvailable).toHaveBeenCalledWith(3000, 'tcp');
    });
  });

  describe('waitForPortToBeAvailable', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait for port to become available', async () => {
      mockPlatformInstance.isPortAvailable
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      // Fast forward time to trigger the checks
      jest.advanceTimersByTime(500);
      await Promise.resolve(); // Let promises resolve
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(true);
    });

    it('should timeout when port does not become available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(false);

      const promise = processFinder.waitForPortToBeAvailable(3000, 1000);

      jest.advanceTimersByTime(1100);

      const result = await promise;

      expect(result).toBe(false);
    });

    it('should return immediately if port is already available', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const result = await processFinder.waitForPortToBeAvailable(3000, 1000);

      expect(result).toBe(true);
    });
  });

  describe('waitForPortToBeBusy', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait for port to become busy', async () => {
      mockPlatformInstance.isPortAvailable
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const promise = processFinder.waitForPortToBeBusy(3000, 1000);

      jest.advanceTimersByTime(500);
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe(true);
    });

    it('should timeout when port does not become busy', async () => {
      mockPlatformInstance.isPortAvailable.mockResolvedValue(true);

      const promise = processFinder.waitForPortToBeBusy(3000, 1000);

      jest.advanceTimersByTime(1100);

      const result = await promise;

      expect(result).toBe(false);
    });
  });
});
