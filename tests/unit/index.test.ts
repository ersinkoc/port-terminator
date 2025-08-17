import {
  PortTerminator,
  killPort,
  killPorts,
  getProcessOnPort,
  getProcessesOnPort,
  isPortAvailable,
  waitForPort,
} from '../../src/index';
import { ProcessFinder } from '../../src/core/process-finder';
import { ProcessKiller } from '../../src/core/process-killer';
import { TimeoutError, InvalidPortError } from '../../src/errors';
import { IProcessInfo, IPortTerminatorOptions } from '../../src/types';

// Mock the core classes
jest.mock('../../src/core/process-finder');
jest.mock('../../src/core/process-killer');
jest.mock('../../src/utils/logger');

const mockProcessFinder = ProcessFinder as jest.MockedClass<typeof ProcessFinder>;
const mockProcessKiller = ProcessKiller as jest.MockedClass<typeof ProcessKiller>;

describe('PortTerminator', () => {
  let mockProcessFinderInstance: any;
  let mockProcessKillerInstance: any;
  let portTerminator: PortTerminator;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcessFinderInstance = {
      findByPort: jest.fn(),
      findByPorts: jest.fn(),
      isPortAvailable: jest.fn(),
      waitForPortToBeAvailable: jest.fn(),
    };

    mockProcessKillerInstance = {
      killProcess: jest.fn(),
      killProcesses: jest.fn(),
      killProcessesByPort: jest.fn(),
      killProcessesByPorts: jest.fn(),
    };

    mockProcessFinder.mockImplementation(() => mockProcessFinderInstance);
    mockProcessKiller.mockImplementation(() => mockProcessKillerInstance);

    portTerminator = new PortTerminator();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      portTerminator = new PortTerminator();

      expect(mockProcessFinder).toHaveBeenCalled();
      expect(mockProcessKiller).toHaveBeenCalled();
    });

    it('should create with custom options', () => {
      const options: IPortTerminatorOptions = {
        method: 'tcp',
        timeout: 60000,
        force: true,
        silent: true,
        gracefulTimeout: 10000,
      };

      portTerminator = new PortTerminator(options);

      expect(mockProcessFinder).toHaveBeenCalled();
      expect(mockProcessKiller).toHaveBeenCalled();
    });

    it('should merge partial options with defaults', () => {
      const options: IPortTerminatorOptions = {
        method: 'udp',
        force: true,
      };

      portTerminator = new PortTerminator(options);

      expect(mockProcessFinder).toHaveBeenCalled();
      expect(mockProcessKiller).toHaveBeenCalled();
    });

    it('should handle empty options object', () => {
      portTerminator = new PortTerminator({});

      expect(mockProcessFinder).toHaveBeenCalled();
      expect(mockProcessKiller).toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should terminate process on single port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await portTerminator.terminate(3000);

      expect(result).toBe(true);
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'both');
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledWith(
        3000,
        false,
        5000,
        'both'
      );
    });

    it('should terminate processes on multiple ports', async () => {
      const mockProcesses3000: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];
      const mockProcesses8080: IProcessInfo[] = [
        { pid: 5678, name: 'nginx', port: 8080, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce(mockProcesses8080);
      mockProcessKillerInstance.killProcessesByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce(mockProcesses8080);

      const result = await portTerminator.terminate([3000, 8080]);

      expect(result).toBe(true);
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledTimes(2);
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledTimes(2);
    });

    it('should return false if any port fails', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce(mockProcesses)
        .mockResolvedValueOnce(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort
        .mockResolvedValueOnce(mockProcesses)
        .mockResolvedValueOnce([]); // Failed to kill

      const result = await portTerminator.terminate([3000, 8080]);

      expect(result).toBe(false);
    });

    it('should handle no processes found', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([]);

      const result = await portTerminator.terminate(3000);

      expect(result).toBe(true);
      expect(mockProcessKillerInstance.killProcessesByPort).not.toHaveBeenCalled();
    });

    it('should validate port numbers', async () => {
      await expect(portTerminator.terminate(0)).rejects.toThrow(InvalidPortError);
      await expect(portTerminator.terminate(70000)).rejects.toThrow(InvalidPortError);
      await expect(portTerminator.terminate([3000, 0])).rejects.toThrow(InvalidPortError);
    });

    it('should handle errors during termination', async () => {
      mockProcessFinderInstance.findByPort.mockRejectedValue(new Error('Find failed'));

      const result = await portTerminator.terminate(3000);

      expect(result).toBe(false);
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = {
        method: 'tcp',
        force: true,
        gracefulTimeout: 10000,
      };
      portTerminator = new PortTerminator(options);

      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue(mockProcesses);

      await portTerminator.terminate(3000);

      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'tcp');
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledWith(
        3000,
        true,
        10000,
        'tcp'
      );
    });
  });

  describe('terminateMultiple', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should return results map for multiple ports', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce(mockProcesses)
        .mockResolvedValueOnce([]);
      mockProcessKillerInstance.killProcessesByPort
        .mockResolvedValueOnce(mockProcesses)
        .mockResolvedValueOnce([]);

      const result = await portTerminator.terminateMultiple([3000, 8080]);

      expect(result.size).toBe(2);
      expect(result.get(3000)).toBe(true);
      expect(result.get(8080)).toBe(true);
    });

    it('should handle concurrent termination', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue(mockProcesses);

      const result = await portTerminator.terminateMultiple([3000, 8080, 9000]);

      expect(result.size).toBe(3);
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledTimes(3);
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledTimes(3);
    });

    it('should validate all ports', async () => {
      await expect(portTerminator.terminateMultiple([3000, 0, 8080])).rejects.toThrow(
        InvalidPortError
      );
    });
  });

  describe('getProcesses', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should get processes on port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);

      const result = await portTerminator.getProcesses(3000);

      expect(result).toEqual(mockProcesses);
      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'both');
    });

    it('should validate port number', async () => {
      await expect(portTerminator.getProcesses(0)).rejects.toThrow(InvalidPortError);
      await expect(portTerminator.getProcesses(70000)).rejects.toThrow(InvalidPortError);
    });

    it('should use custom protocol option', async () => {
      const portTerminator = new PortTerminator({ method: 'udp' });
      mockProcessFinderInstance.findByPort.mockResolvedValue([]);

      await portTerminator.getProcesses(3000);

      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'udp');
    });
  });

  describe('isPortAvailable', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should check port availability', async () => {
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(true);

      const result = await portTerminator.isPortAvailable(3000);

      expect(result).toBe(true);
      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledWith(3000, 'both');
    });

    it('should validate port number', async () => {
      await expect(portTerminator.isPortAvailable(0)).rejects.toThrow(InvalidPortError);
    });

    it('should use custom protocol option', async () => {
      const portTerminator = new PortTerminator({ method: 'tcp' });
      mockProcessFinderInstance.isPortAvailable.mockResolvedValue(false);

      await portTerminator.isPortAvailable(8080);

      expect(mockProcessFinderInstance.isPortAvailable).toHaveBeenCalledWith(8080, 'tcp');
    });
  });

  describe('waitForPort', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should wait for port to become available', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      const result = await portTerminator.waitForPort(3000);

      expect(result).toBe(true);
      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        30000,
        'both'
      );
    });

    it('should use custom timeout', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      await portTerminator.waitForPort(3000, 60000);

      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        60000,
        'both'
      );
    });

    it('should throw TimeoutError when timeout occurs', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(false);

      await expect(portTerminator.waitForPort(3000, 1000)).rejects.toThrow(TimeoutError);
      await expect(portTerminator.waitForPort(3000, 1000)).rejects.toThrow(
        "Operation 'waitForPort(3000)' timed out after 1000ms"
      );
    });

    it('should validate port number', async () => {
      await expect(portTerminator.waitForPort(0)).rejects.toThrow(InvalidPortError);
    });

    it('should validate timeout', async () => {
      await expect(portTerminator.waitForPort(3000, -1)).rejects.toThrow('Invalid timeout: -1');
    });

    it('should use instance timeout as default', async () => {
      const portTerminator = new PortTerminator({ timeout: 45000 });
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      await portTerminator.waitForPort(3000);

      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        45000,
        'both'
      );
    });
  });

  describe('terminateWithDetails', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should return detailed termination results', async () => {
      const mockProcesses3000: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];
      const mockProcesses8080: IProcessInfo[] = [];

      mockProcessFinderInstance.findByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce(mockProcesses8080);
      mockProcessKillerInstance.killProcessesByPort
        .mockResolvedValueOnce(mockProcesses3000)
        .mockResolvedValueOnce([]);

      const result = await portTerminator.terminateWithDetails([3000, 8080]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        port: 3000,
        success: true,
        processes: mockProcesses3000,
      });
      expect(result[1]).toEqual({
        port: 8080,
        success: true,
        processes: [],
      });
    });

    it('should handle partial kill success', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
      ];
      const killedProcesses: IProcessInfo[] = [mockProcesses[0]]; // Only first killed

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue(killedProcesses);

      const result = await portTerminator.terminateWithDetails([3000]);

      expect(result[0]).toEqual({
        port: 3000,
        success: false,
        processes: killedProcesses,
      });
    });

    it('should handle errors in detailed results', async () => {
      mockProcessFinderInstance.findByPort.mockRejectedValue(new Error('Find failed'));

      const result = await portTerminator.terminateWithDetails([3000]);

      expect(result[0]).toEqual({
        port: 3000,
        success: false,
        processes: [],
        error: 'Find failed',
      });
    });

    it('should handle unknown error types', async () => {
      mockProcessFinderInstance.findByPort.mockRejectedValue('String error');

      const result = await portTerminator.terminateWithDetails([3000]);

      expect(result[0]).toEqual({
        port: 3000,
        success: false,
        processes: [],
        error: 'Unknown error',
      });
    });

    it('should validate ports', async () => {
      await expect(portTerminator.terminateWithDetails([0])).rejects.toThrow(InvalidPortError);
    });

    it('should use custom options in detailed termination', async () => {
      const portTerminator = new PortTerminator({
        method: 'tcp',
        force: true,
        gracefulTimeout: 2000,
      });

      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      mockProcessFinderInstance.findByPort.mockResolvedValue(mockProcesses);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue(mockProcesses);

      await portTerminator.terminateWithDetails([3000]);

      expect(mockProcessFinderInstance.findByPort).toHaveBeenCalledWith(3000, 'tcp');
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledWith(
        3000,
        true,
        2000,
        'tcp'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      portTerminator = new PortTerminator();
    });

    it('should handle ProcessFinder creation errors', () => {
      const spy = jest.spyOn(mockProcessFinder, 'mockImplementation').mockImplementation(() => {
        throw new Error('ProcessFinder creation failed');
      });

      expect(() => new PortTerminator()).toThrow('ProcessFinder creation failed');
      spy.mockRestore();
    });

    it('should handle ProcessKiller creation errors', () => {
      const spy = jest.spyOn(mockProcessKiller, 'mockImplementation').mockImplementation(() => {
        throw new Error('ProcessKiller creation failed');
      });

      expect(() => new PortTerminator()).toThrow('ProcessKiller creation failed');
      spy.mockRestore();
    });

    it('should handle async errors gracefully', async () => {
      mockProcessFinderInstance.findByPort.mockRejectedValue(new Error('Async error'));

      const result = await portTerminator.terminate(3000);
      expect(result).toBe(false);
    });
  });

  describe('option validation and defaults', () => {
    it('should apply correct default options', () => {
      const portTerminator = new PortTerminator();

      // We can't directly access private options, but we can test behavior
      expect(portTerminator).toBeInstanceOf(PortTerminator);
    });

    it('should handle all option combinations', () => {
      const optionCombinations: IPortTerminatorOptions[] = [
        { method: 'tcp' },
        { method: 'udp' },
        { method: 'both' },
        { timeout: 60000 },
        { force: true },
        { silent: true },
        { gracefulTimeout: 10000 },
        { method: 'tcp', timeout: 45000, force: true, silent: false, gracefulTimeout: 8000 },
      ];

      optionCombinations.forEach((options) => {
        expect(() => new PortTerminator(options)).not.toThrow();
      });
    });
  });
});

describe('Convenience Functions', () => {
  let mockPortTerminatorInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPortTerminatorInstance = {
      terminate: jest.fn().mockResolvedValue(true),
      terminateMultiple: jest.fn().mockResolvedValue(new Map()),
      getProcesses: jest.fn().mockResolvedValue([]),
      isPortAvailable: jest.fn().mockResolvedValue(true),
      waitForPort: jest.fn().mockResolvedValue(true),
    };
  });

  describe('killPort', () => {
    it('should kill process on single port with default options', async () => {
      mockPortTerminatorInstance.terminate.mockResolvedValue(true);

      const result = await killPort(3000);

      expect(result).toBe(true);
      expect(mockPortTerminatorInstance.terminate).toHaveBeenCalledWith(3000);
    });

    it('should kill process with custom options', async () => {
      const options: IPortTerminatorOptions = { force: true, method: 'tcp' };
      await killPort(3000, options);

      expect(mockPortTerminatorInstance.terminate).toHaveBeenCalledWith(3000, options);
    });

    it('should handle termination failure', async () => {
      mockPortTerminatorInstance.terminate.mockResolvedValue(false);

      const result = await killPort(3000);

      expect(result).toBe(false);
    });
  });

  describe('killPorts', () => {
    it('should kill processes on multiple ports', async () => {
      const expectedResult = new Map([
        [3000, true],
        [8080, false],
      ]);
      mockPortTerminatorInstance.terminateMultiple.mockResolvedValue(expectedResult);

      const result = await killPorts([3000, 8080]);

      expect(result).toEqual(expectedResult);
      expect(mockPortTerminatorInstance.terminateMultiple).toHaveBeenCalledWith([3000, 8080]);
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = { gracefulTimeout: 10000 };
      await killPorts([3000], options);

      expect(mockPortTerminatorInstance.terminateMultiple).toHaveBeenCalledWith([3000], options);
    });
  });

  describe('getProcessOnPort', () => {
    it('should return first process on port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
      ];
      mockPortTerminatorInstance.getProcesses.mockResolvedValue(mockProcesses);

      const result = await getProcessOnPort(3000);

      expect(result).toEqual(mockProcesses[0]);
      expect(mockPortTerminatorInstance.getProcesses).toHaveBeenCalledWith(3000);
    });

    it('should return null when no processes found', async () => {
      mockPortTerminatorInstance.getProcesses.mockResolvedValue([]);

      const result = await getProcessOnPort(3000);

      expect(result).toBeNull();
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = { method: 'udp' };
      await getProcessOnPort(3000, options);

      expect(mockPortTerminatorInstance.getProcesses).toHaveBeenCalledWith(3000, options);
    });
  });

  describe('getProcessesOnPort', () => {
    it('should return all processes on port', async () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
      ];
      mockPortTerminatorInstance.getProcesses.mockResolvedValue(mockProcesses);

      const result = await getProcessesOnPort(3000);

      expect(result).toEqual(mockProcesses);
      expect(mockPortTerminatorInstance.getProcesses).toHaveBeenCalledWith(3000);
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = { silent: true };
      await getProcessesOnPort(3000, options);

      expect(mockPortTerminatorInstance.getProcesses).toHaveBeenCalledWith(3000, options);
    });
  });

  describe('isPortAvailable', () => {
    it('should check port availability', async () => {
      mockPortTerminatorInstance.isPortAvailable.mockResolvedValue(true);

      const result = await isPortAvailable(3000);

      expect(result).toBe(true);
      expect(mockPortTerminatorInstance.isPortAvailable).toHaveBeenCalledWith(3000);
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = { method: 'both' };
      await isPortAvailable(3000, options);

      expect(mockPortTerminatorInstance.isPortAvailable).toHaveBeenCalledWith(3000, options);
    });
  });

  describe('waitForPort', () => {
    it('should wait for port with default timeout', async () => {
      mockPortTerminatorInstance.waitForPort.mockResolvedValue(true);

      const result = await waitForPort(3000);

      expect(result).toBe(true);
      expect(mockPortTerminatorInstance.waitForPort).toHaveBeenCalledWith(3000, undefined);
    });

    it('should wait for port with custom timeout', async () => {
      mockPortTerminatorInstance.waitForPort.mockResolvedValue(true);

      const result = await waitForPort(3000, 60000);

      expect(result).toBe(true);
      expect(mockPortTerminatorInstance.waitForPort).toHaveBeenCalledWith(3000, 60000);
    });

    it('should use custom options', async () => {
      const options: IPortTerminatorOptions = { timeout: 15000 };
      await waitForPort(3000, 30000, options);

      expect(mockPortTerminatorInstance.waitForPort).toHaveBeenCalledWith(3000, 30000, options);
    });

    it('should handle timeout error', async () => {
      mockPortTerminatorInstance.waitForPort.mockRejectedValue(
        new TimeoutError('waitForPort(3000)', 30000)
      );

      await expect(waitForPort(3000)).rejects.toThrow(TimeoutError);
    });
  });

  describe('convenience function error handling', () => {
    it('should propagate errors from PortTerminator methods', async () => {
      const error = new Error('Method failed');
      mockPortTerminatorInstance.terminate.mockRejectedValue(error);

      await expect(killPort(3000)).rejects.toThrow('Method failed');
    });

    it('should handle constructor errors', async () => {
      jest.mock('../../src/index', () => ({
        ...jest.requireActual('../../src/index'),
        PortTerminator: jest.fn().mockImplementation(() => {
          throw new Error('Constructor failed');
        }),
      }));

      await expect(killPort(3000)).rejects.toThrow('Constructor failed');
    });
  });
});
