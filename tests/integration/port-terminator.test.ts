import {
  PortTerminator,
  killPort,
  killPorts,
  getProcessOnPort,
  isPortAvailable,
} from '../../src/index';
import { IProcessInfo } from '../../src/types';
import { InvalidPortError, TimeoutError } from '../../src/errors';

jest.mock('../../src/core/process-finder');
jest.mock('../../src/core/process-killer');
jest.mock('../../src/core/port-scanner');
jest.mock('../../src/utils/platform');

describe.skip('PortTerminator Integration', () => {
  let mockProcessFinder: any;
  let mockProcessKiller: any;
  let mockPortScanner: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { getPlatform } = require('../../src/utils/platform');
    getPlatform.mockReturnValue('linux');

    mockProcessFinder = {
      findByPort: jest.fn(),
      findByPorts: jest.fn(),
      isPortAvailable: jest.fn(),
      waitForPortToBeAvailable: jest.fn(),
    };

    mockProcessKiller = {
      killProcessesByPort: jest.fn(),
    };

    mockPortScanner = {
      scanPort: jest.fn(),
    };

    const { ProcessFinder } = require('../../src/core/process-finder');
    const { ProcessKiller } = require('../../src/core/process-killer');
    const { PortScanner } = require('../../src/core/port-scanner');

    ProcessFinder.mockImplementation(() => mockProcessFinder);
    ProcessKiller.mockImplementation(() => mockProcessKiller);
    PortScanner.mockImplementation(() => mockPortScanner);
  });

  describe('PortTerminator class', () => {
    let terminator: PortTerminator;

    beforeEach(() => {
      terminator = new PortTerminator();
    });

    describe('terminate', () => {
      const mockProcesses: IProcessInfo[] = [
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ];

      it('should terminate process on single port', async () => {
        mockProcessFinder.findByPort.mockResolvedValue(mockProcesses);
        mockProcessKiller.killProcessesByPort.mockResolvedValue(mockProcesses);

        const result = await terminator.terminate(3000);

        expect(result).toBe(true);
        expect(mockProcessFinder.findByPort).toHaveBeenCalledWith(3000, 'both');
        expect(mockProcessKiller.killProcessesByPort).toHaveBeenCalledWith(
          3000,
          false,
          5000,
          'both'
        );
      });

      it('should terminate processes on multiple ports', async () => {
        mockProcessFinder.findByPort.mockResolvedValueOnce(mockProcesses).mockResolvedValueOnce([]);
        mockProcessKiller.killProcessesByPort
          .mockResolvedValueOnce(mockProcesses)
          .mockResolvedValueOnce([]);

        const result = await terminator.terminate([3000, 8080]);

        expect(result).toBe(true);
        expect(mockProcessFinder.findByPort).toHaveBeenCalledTimes(2);
      });

      it('should return false if any port fails', async () => {
        mockProcessFinder.findByPort
          .mockResolvedValueOnce(mockProcesses)
          .mockResolvedValueOnce(mockProcesses);
        mockProcessKiller.killProcessesByPort
          .mockResolvedValueOnce(mockProcesses)
          .mockResolvedValueOnce([]); // Failed to kill

        const result = await terminator.terminate([3000, 8080]);

        expect(result).toBe(false);
      });

      it('should handle no processes found', async () => {
        mockProcessFinder.findByPort.mockResolvedValue([]);

        const result = await terminator.terminate(3000);

        expect(result).toBe(true);
        expect(mockProcessKiller.killProcessesByPort).not.toHaveBeenCalled();
      });

      it('should validate port numbers', async () => {
        await expect(terminator.terminate(0)).rejects.toThrow(InvalidPortError);
        await expect(terminator.terminate([3000, 70000])).rejects.toThrow(InvalidPortError);
      });
    });

    describe('terminateMultiple', () => {
      it('should return results map', async () => {
        const mockProcesses: IProcessInfo[] = [
          { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        ];

        mockProcessFinder.findByPort.mockResolvedValueOnce(mockProcesses).mockResolvedValueOnce([]);
        mockProcessKiller.killProcessesByPort
          .mockResolvedValueOnce(mockProcesses)
          .mockResolvedValueOnce([]);

        const result = await terminator.terminateMultiple([3000, 8080]);

        expect(result.get(3000)).toBe(true);
        expect(result.get(8080)).toBe(true);
      });
    });

    describe('getProcesses', () => {
      it('should return processes on port', async () => {
        const mockProcesses: IProcessInfo[] = [
          { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        ];

        mockProcessFinder.findByPort.mockResolvedValue(mockProcesses);

        const result = await terminator.getProcesses(3000);

        expect(result).toEqual(mockProcesses);
        expect(mockProcessFinder.findByPort).toHaveBeenCalledWith(3000, 'both');
      });

      it('should validate port number', async () => {
        await expect(terminator.getProcesses(0)).rejects.toThrow(InvalidPortError);
      });
    });

    describe('isPortAvailable', () => {
      it('should check port availability', async () => {
        mockProcessFinder.isPortAvailable.mockResolvedValue(true);

        const result = await terminator.isPortAvailable(3000);

        expect(result).toBe(true);
        expect(mockProcessFinder.isPortAvailable).toHaveBeenCalledWith(3000, 'both');
      });
    });

    describe('waitForPort', () => {
      it('should wait for port to become available', async () => {
        mockProcessFinder.waitForPortToBeAvailable.mockResolvedValue(true);

        const result = await terminator.waitForPort(3000);

        expect(result).toBe(true);
        expect(mockProcessFinder.waitForPortToBeAvailable).toHaveBeenCalledWith(
          3000,
          30000,
          'both'
        );
      });

      it('should throw TimeoutError when timeout occurs', async () => {
        mockProcessFinder.waitForPortToBeAvailable.mockResolvedValue(false);

        await expect(terminator.waitForPort(3000, 1000)).rejects.toThrow(TimeoutError);
      });
    });

    describe('terminateWithDetails', () => {
      it('should return detailed termination results', async () => {
        const mockProcesses: IProcessInfo[] = [
          { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        ];

        mockProcessFinder.findByPort.mockResolvedValue(mockProcesses);
        mockProcessKiller.killProcessesByPort.mockResolvedValue(mockProcesses);

        const results = await terminator.terminateWithDetails([3000]);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          port: 3000,
          success: true,
          processes: mockProcesses,
        });
      });

      it('should handle errors in detailed results', async () => {
        mockProcessFinder.findByPort.mockRejectedValue(new Error('Find failed'));

        const results = await terminator.terminateWithDetails([3000]);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          port: 3000,
          success: false,
          processes: [],
          error: 'Find failed',
        });
      });
    });
  });

  describe('convenience functions', () => {
    describe('killPort', () => {
      it('should kill process on single port', async () => {
        const mockProcesses: IProcessInfo[] = [
          { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
        ];

        mockProcessFinder.findByPort.mockResolvedValue(mockProcesses);
        mockProcessKiller.killProcessesByPort.mockResolvedValue(mockProcesses);

        const result = await killPort(3000);

        expect(result).toBe(true);
      });

      it('should use custom options', async () => {
        mockProcessFinder.findByPort.mockResolvedValue([]);

        const result = await killPort(3000, { force: true, method: 'tcp' });

        expect(result).toBe(true);
      });
    });

    describe('killPorts', () => {
      it('should kill processes on multiple ports', async () => {
        mockProcessFinder.findByPort.mockResolvedValue([]);

        const result = await killPorts([3000, 8080]);

        expect(result.get(3000)).toBe(true);
        expect(result.get(8080)).toBe(true);
      });
    });

    describe('getProcessOnPort', () => {
      it('should return first process on port', async () => {
        const mockProcesses: IProcessInfo[] = [
          { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
          { pid: 5678, name: 'nginx', port: 3000, protocol: 'tcp' },
        ];

        mockProcessFinder.findByPort.mockResolvedValue(mockProcesses);

        const result = await getProcessOnPort(3000);

        expect(result).toEqual(mockProcesses[0]);
      });

      it('should return null when no processes found', async () => {
        mockProcessFinder.findByPort.mockResolvedValue([]);

        const result = await getProcessOnPort(3000);

        expect(result).toBeNull();
      });
    });

    describe('isPortAvailable', () => {
      it('should check port availability', async () => {
        mockProcessFinder.isPortAvailable.mockResolvedValue(true);

        const result = await isPortAvailable(3000);

        expect(result).toBe(true);
      });
    });
  });
});
