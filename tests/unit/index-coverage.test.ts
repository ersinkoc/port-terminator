import { PortTerminator } from '../../src/index';
import { ProcessFinder } from '../../src/core/process-finder';
import { ProcessKiller } from '../../src/core/process-killer';
import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/core/process-finder');
jest.mock('../../src/core/process-killer');
jest.mock('../../src/utils/logger');

const mockProcessFinder = ProcessFinder as jest.MockedClass<typeof ProcessFinder>;
const mockProcessKiller = ProcessKiller as jest.MockedClass<typeof ProcessKiller>;
const mockLogger = Logger as jest.MockedClass<typeof Logger>;

describe('PortTerminator - Additional Coverage Tests', () => {
  let terminator: PortTerminator;
  let mockProcessFinderInstance: any;
  let mockProcessKillerInstance: any;
  let mockLoggerInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcessFinderInstance = {
      findByPort: jest.fn(),
      isPortAvailable: jest.fn(),
      waitForPortToBeAvailable: jest.fn(),
    };

    mockProcessKillerInstance = {
      killProcess: jest.fn(),
      killProcessesByPort: jest.fn(),
    };

    mockLoggerInstance = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setLevel: jest.fn(),
      setSilent: jest.fn(),
    };

    mockProcessFinder.mockImplementation(() => mockProcessFinderInstance);
    mockProcessKiller.mockImplementation(() => mockProcessKillerInstance);
    mockLogger.mockImplementation(() => mockLoggerInstance);

    terminator = new PortTerminator();
  });

  describe('terminateMultiple - error handling branch coverage', () => {
    it('should handle non-Error objects thrown in catch block', async () => {
      // Mock findByPort to throw a non-Error object
      mockProcessFinderInstance.findByPort.mockRejectedValue('String error');

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Unknown error'
      );
    });

    it('should handle null thrown in catch block', async () => {
      // Mock findByPort to throw null
      mockProcessFinderInstance.findByPort.mockRejectedValue(null);

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Unknown error'
      );
    });

    it('should handle undefined thrown in catch block', async () => {
      // Mock findByPort to throw undefined
      mockProcessFinderInstance.findByPort.mockRejectedValue(undefined);

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Unknown error'
      );
    });

    it('should handle number thrown in catch block', async () => {
      // Mock findByPort to throw a number
      mockProcessFinderInstance.findByPort.mockRejectedValue(404);

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Unknown error'
      );
    });

    it('should handle object (non-Error) thrown in catch block', async () => {
      // Mock findByPort to throw a plain object
      mockProcessFinderInstance.findByPort.mockRejectedValue({
        code: 'CUSTOM_ERROR',
        details: 'Something went wrong',
      });

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Unknown error'
      );
    });

    it('should handle Error objects correctly (existing behavior)', async () => {
      // Mock findByPort to throw a proper Error
      mockProcessFinderInstance.findByPort.mockRejectedValue(new Error('Custom error message'));

      const results = await terminator.terminateMultiple([3000]);

      expect(results.get(3000)).toBe(false);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Custom error message'
      );
    });

    it('should handle mixed error types across multiple ports', async () => {
      // Different error types for different ports
      mockProcessFinderInstance.findByPort
        .mockRejectedValueOnce(new Error('Error for port 3000'))
        .mockRejectedValueOnce('String error for port 3001')
        .mockRejectedValueOnce(null)
        .mockResolvedValueOnce([{ pid: 1234, name: 'node', port: 3003, protocol: 'tcp' }]);

      mockProcessKillerInstance.killProcessesByPort.mockResolvedValue([
        { pid: 1234, name: 'node', port: 3003, protocol: 'tcp' },
      ]);

      const results = await terminator.terminateMultiple([3000, 3001, 3002, 3003]);

      expect(results.get(3000)).toBe(false);
      expect(results.get(3001)).toBe(false);
      expect(results.get(3002)).toBe(false);
      expect(results.get(3003)).toBe(true);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3000: Error for port 3000'
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3001: Unknown error'
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Error terminating processes on port 3002: Unknown error'
      );
    });
  });
});
