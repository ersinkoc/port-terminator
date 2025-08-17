import { Logger } from '../../../src/utils/logger';

// Mock console methods
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Logger - Additional Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('formatArgs - switch default case coverage', () => {
    it('should handle unknown placeholder types in format string', () => {
      const logger = new Logger();

      // Test with custom/unknown placeholder that doesn't match %s, %d, %j, %o
      logger.info('Unknown placeholder: %x %y %z', 'value1', 'value2', 'value3');

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      // Unknown placeholders should be kept as-is
      expect(output).toContain('%x');
      expect(output).toContain('%y');
      expect(output).toContain('%z');
    });

    it('should handle mixed known and unknown placeholders', () => {
      const logger = new Logger();

      logger.info('String: %s, Number: %d, Unknown: %x, Object: %o', 'test', 42, 'ignored', {
        key: 'value',
      });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      expect(output).toContain('String: test');
      expect(output).toContain('Number: 42');
      expect(output).toContain('Unknown: %x'); // Unknown placeholder preserved
      expect(output).toContain('Object: "ignored"'); // Since %x doesn't consume args, %o gets 'ignored'
    });

    it('should handle format strings with only unknown placeholders', () => {
      const logger = new Logger('debug'); // Set level to debug

      logger.debug('Custom formats: %x %y %z');

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      expect(output).toContain('Custom formats: %x %y %z');
    });

    it('should handle multiple occurrences of unknown placeholders', () => {
      const logger = new Logger();

      logger.warn('Multiple unknowns: %x %x %y %y %z %z', 'a', 'b', 'c');

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      // All unknown placeholders should remain unchanged
      expect(output).toContain('Multiple unknowns: %x %x %y %y %z %z');
    });

    it('should handle edge case with percent sign not followed by known format', () => {
      const logger = new Logger();

      logger.error('Percent signs: %% %a %b %c %', 'test');

      expect(mockConsoleError).toHaveBeenCalled();
      const output = mockConsoleError.mock.calls[0][0];

      // %% is replaced with % by the format function
      expect(output).toContain('Percent signs: %');
      expect(output).toContain('%a');
      expect(output).toContain('%b');
      expect(output).toContain('%c');
    });

    it('should handle format string with no placeholders but with args', () => {
      const logger = new Logger();

      logger.info('No placeholders here', 'extra', 'args', 'ignored');

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      expect(output).toContain('No placeholders here');
    });

    it('should handle complex nested objects with unknown placeholders', () => {
      const logger = new Logger('debug'); // Set level to debug
      const complexObj = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };

      logger.debug('Unknown %x with object %o and unknown %y', complexObj, 'unused');

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];

      expect(output).toContain('%x'); // Unknown preserved
      expect(output).toContain('"level3":"deep value"'); // Object formatted
      expect(output).toContain('%y'); // Unknown preserved
    });
  });
});
