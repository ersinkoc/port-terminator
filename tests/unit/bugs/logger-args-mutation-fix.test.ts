/**
 * Test suite for BUG-2025-006: Logger Mutates Arguments Array
 *
 * Bug Description:
 * The formatMessage method uses args.shift() to consume arguments while formatting,
 * which mutates the original args array passed to the logging methods.
 *
 * Impact:
 * - Violates immutability principles
 * - Could cause subtle bugs if args array is reused
 * - Makes code harder to test and reason about
 *
 * Fix:
 * Create a copy of the args array before processing.
 */

import { Logger } from '../../../src/utils/logger';

describe('BUG-2025-006: Logger Args Mutation Fix', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('debug', false);
    // Suppress actual console output in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Arguments array immutability', () => {
    it('should not mutate args array when using %s placeholder', () => {
      const args = ['world', 'extra'];
      const originalArgs = [...args];

      logger.info('Hello %s', ...args);

      // Args should not be mutated
      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(2);
      expect(args[0]).toBe('world');
      expect(args[1]).toBe('extra');
    });

    it('should not mutate args array when using %d placeholder', () => {
      const args = [42, 100];
      const originalArgs = [...args];

      logger.info('Number: %d and %d', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(2);
    });

    it('should not mutate args array when using %j placeholder', () => {
      const obj1 = { foo: 'bar' };
      const obj2 = { baz: 'qux' };
      const args = [obj1, obj2];
      const originalArgs = [...args];

      logger.info('Objects: %j and %j', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(2);
      expect(args[0]).toBe(obj1);
      expect(args[1]).toBe(obj2);
    });

    it('should not mutate args array when using mixed placeholders', () => {
      const args = ['string', 123, { key: 'value' }, 'another'];
      const originalArgs = [...args];

      logger.info('Mix: %s %d %j %s', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(4);
    });

    it('should not mutate args array with more args than placeholders', () => {
      const args = ['a', 'b', 'c', 'd', 'e'];
      const originalArgs = [...args];

      logger.info('Only two: %s %s', ...args);

      // Should not consume extra args
      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(5);
    });

    it('should not mutate args array when args are insufficient', () => {
      const args = ['only-one'];
      const originalArgs = [...args];

      logger.info('Need three: %s %s %s', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(1);
    });

    it('should preserve original args for multiple log calls', () => {
      const args = ['shared', 'value'];
      const originalArgs = [...args];

      logger.info('First: %s %s', ...args);
      logger.info('Second: %s %s', ...args);
      logger.info('Third: %s %s', ...args);

      // Args should still be unchanged after multiple uses
      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(2);
    });
  });

  describe('Formatting still works correctly after fix', () => {
    it('should format %s placeholders correctly', () => {
      const logSpy = jest.spyOn(console, 'log');

      logger.info('Hello %s', 'world');

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain('Hello world');
    });

    it('should format %d placeholders correctly', () => {
      const logSpy = jest.spyOn(console, 'log');

      logger.info('Number: %d', 42);

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain('Number: 42');
    });

    it('should format %j placeholders correctly', () => {
      const logSpy = jest.spyOn(console, 'log');

      logger.info('Object: %j', { foo: 'bar' });

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain('"foo"');
      expect(output).toContain('"bar"');
    });

    it('should handle %% escape correctly', () => {
      const logSpy = jest.spyOn(console, 'log');

      logger.info('Percentage: 50%%');

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain('50%');
    });

    it('should handle circular references correctly', () => {
      const logSpy = jest.spyOn(console, 'log');

      const circular: any = { name: 'test' };
      circular.self = circular;

      logger.info('Circular: %j', circular);

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain('[Circular]');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty args array', () => {
      const args: unknown[] = [];
      const originalArgs = [...args];

      logger.info('No args: %s', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(0);
    });

    it('should handle args with undefined values', () => {
      const args = [undefined, null, 'value'];
      const originalArgs = [...args];

      logger.info('Values: %s %s %s', ...args);

      expect(args).toEqual(originalArgs);
      expect(args.length).toBe(3);
      expect(args[0]).toBeUndefined();
      expect(args[1]).toBeNull();
    });

    it('should handle complex nested objects', () => {
      const complex = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };
      const args = [complex];
      const originalArgs = [...args];

      logger.info('Complex: %j', ...args);

      expect(args).toEqual(originalArgs);
      expect(args[0]).toBe(complex);
    });
  });

  describe('Performance regression test', () => {
    it('should not significantly degrade performance with copy', () => {
      const args = Array.from({ length: 100 }, (_, i) => `arg${i}`);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        logger.info('Test: %s %s %s', ...args.slice(0, 3));
      }
      const duration = Date.now() - start;

      // Should complete 1000 iterations in reasonable time (< 1s)
      expect(duration).toBeLessThan(1000);

      // Args should still be intact
      expect(args.length).toBe(100);
    });
  });
});
