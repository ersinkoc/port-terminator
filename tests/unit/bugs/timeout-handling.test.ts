import { PortTerminator } from '../../../src/index';
import { ProcessFinder } from '../../../src/core/process-finder';
import { ProcessKiller } from '../../../src/core/process-killer';

// Mock the core classes
jest.mock('../../../src/core/process-finder');
jest.mock('../../../src/core/process-killer');
jest.mock('../../../src/utils/logger');

const mockProcessFinder = ProcessFinder as jest.MockedClass<typeof ProcessFinder>;
const mockProcessKiller = ProcessKiller as jest.MockedClass<typeof ProcessKiller>;

describe('Bug Fixes - Timeout Handling', () => {
  let mockProcessFinderInstance: any;
  let mockProcessKillerInstance: any;

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
  });

  describe('Bug #1: waitForPort should accept timeout=0', () => {
    it('should use timeout=0 when explicitly passed, not default', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      const terminator = new PortTerminator({ timeout: 30000 });

      // User explicitly wants immediate check with timeout=0
      await terminator.waitForPort(3000, 0);

      // Should call with 0, not the default 30000
      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        0,  // Should be 0, not 30000
        'both'
      );
    });

    it('should use default timeout when timeout is undefined', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      const terminator = new PortTerminator({ timeout: 30000 });

      // No timeout parameter means use default
      await terminator.waitForPort(3000);

      // Should call with default 30000
      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        30000,
        'both'
      );
    });

    it('should use explicit timeout when non-zero value passed', async () => {
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      const terminator = new PortTerminator({ timeout: 30000 });

      await terminator.waitForPort(3000, 5000);

      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        5000,
        'both'
      );
    });
  });

  describe('Bug #2: Constructor should accept timeout=0 and gracefulTimeout=0', () => {
    it('should use timeout=0 when explicitly passed in constructor', () => {
      const terminator = new PortTerminator({ timeout: 0 });

      // Access private options through a method that uses it
      // We can verify this indirectly through waitForPort with undefined timeout
      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      terminator.waitForPort(3000); // No timeout param, should use constructor default

      // Should use 0 from constructor, not 30000 fallback
      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        0,  // Should be 0 from constructor
        'both'
      );
    });

    it('should use gracefulTimeout=0 when explicitly passed in constructor', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ]);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue([
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ]);

      const terminator = new PortTerminator({ gracefulTimeout: 0, force: false });

      await terminator.terminate(3000);

      // Should call killProcessesByPort with gracefulTimeout=0
      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledWith(
        3000,
        false,  // force
        0,      // Should be 0, not 5000
        'both'
      );
    });

    it('should use default timeout=30000 when not specified', () => {
      const terminator = new PortTerminator();

      mockProcessFinderInstance.waitForPortToBeAvailable.mockResolvedValue(true);

      terminator.waitForPort(3000); // No timeout param

      expect(mockProcessFinderInstance.waitForPortToBeAvailable).toHaveBeenCalledWith(
        3000,
        30000,
        'both'
      );
    });

    it('should use default gracefulTimeout=5000 when not specified', async () => {
      mockProcessFinderInstance.findByPort.mockResolvedValue([
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ]);
      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue([
        { pid: 1234, name: 'node', port: 3000, protocol: 'tcp' },
      ]);

      const terminator = new PortTerminator();

      await terminator.terminate(3000);

      expect(mockProcessKillerInstance.killProcessesByPort).toHaveBeenCalledWith(
        3000,
        false,
        5000,  // Default
        'both'
      );
    });
  });
});
