import { Logger, defaultLogger } from '../../../src/utils/logger';

// Mock console methods
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    it('should create logger with default level and non-silent', () => {
      const logger = new Logger();

      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom level', () => {
      const logger = new Logger('debug');

      logger.debug('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should create logger with silent mode', () => {
      const logger = new Logger('info', true);

      logger.info('test message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should set log level to error', () => {
      const logger = new Logger('info');
      logger.setLevel('error');

      logger.info('info message');
      logger.error('error message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should set log level to warn', () => {
      const logger = new Logger('error');
      logger.setLevel('warn');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1); // warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });

    it('should set log level to info', () => {
      const logger = new Logger('error');
      logger.setLevel('info');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(2); // info, warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });

    it('should set log level to debug', () => {
      const logger = new Logger('error');
      logger.setLevel('debug');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(3); // debug, info, warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });
  });

  describe('setSilent', () => {
    it('should enable silent mode', () => {
      const logger = new Logger('info', false);
      logger.setSilent(true);

      logger.info('test message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should disable silent mode', () => {
      const logger = new Logger('info', true);
      logger.setSilent(false);

      logger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger('debug', false);
    });

    describe('error', () => {
      it('should log error messages', () => {
        logger.error('error message');

        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        const call = mockConsoleError.mock.calls[0][0];
        expect(call).toContain('ERROR');
        expect(call).toContain('error message');
        expect(call).toContain('\x1b[31m'); // red color
      });

      it('should log error with arguments', () => {
        logger.error('error %s %d', 'test', 123);

        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        const call = mockConsoleError.mock.calls[0][0];
        expect(call).toContain('error test 123');
      });
    });

    describe('warn', () => {
      it('should log warn messages', () => {
        logger.warn('warn message');

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('WARN');
        expect(call).toContain('warn message');
        expect(call).toContain('\x1b[33m'); // yellow color
      });

      it('should log warn with arguments', () => {
        logger.warn('warn %s', 'test');

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('warn test');
      });
    });

    describe('info', () => {
      it('should log info messages', () => {
        logger.info('info message');

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('INFO');
        expect(call).toContain('info message');
        expect(call).toContain('\x1b[34m'); // blue color
      });

      it('should log info with arguments', () => {
        logger.info('info %d %j', 42, { key: 'value' });

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('info 42 {"key":"value"}');
      });
    });

    describe('debug', () => {
      it('should log debug messages', () => {
        logger.debug('debug message');

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('DEBUG');
        expect(call).toContain('debug message');
        expect(call).toContain('\x1b[2m'); // dim color
      });

      it('should log debug with arguments', () => {
        logger.debug('debug %s test', 'argument');

        expect(mockConsoleLog).toHaveBeenCalledTimes(1);
        const call = mockConsoleLog.mock.calls[0][0];
        expect(call).toContain('debug argument test');
      });
    });
  });

  describe('message formatting', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger('debug', false);
    });

    it('should format string placeholders', () => {
      logger.info('Hello %s', 'world');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Hello world');
    });

    it('should format number placeholders', () => {
      logger.info('Count: %d', 42);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Count: 42');
    });

    it('should format JSON placeholders', () => {
      logger.info('Data: %j', { key: 'value', num: 123 });

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Data: {"key":"value","num":123}');
    });

    it('should handle circular JSON objects', () => {
      const obj: any = { key: 'value' };
      obj.circular = obj;

      logger.info('Circular: %j', obj);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Circular: [Circular]');
    });

    it('should handle escaped percent signs', () => {
      logger.info('Literal %% sign');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Literal % sign');
    });

    it('should handle mixed placeholders', () => {
      logger.info('String: %s, Number: %d, JSON: %j, Literal: %%', 'test', 42, { a: 1 });

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('String: test, Number: 42, JSON: {"a":1}, Literal: %');
    });

    it('should handle placeholders without arguments', () => {
      logger.info('Missing args %s %d %j');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Missing args %s %d %j');
    });

    it('should handle more arguments than placeholders', () => {
      logger.info('Only %s', 'one', 'two', 'three');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Only one');
    });

    it('should handle messages without placeholders but with arguments', () => {
      logger.info('No placeholders', 'arg1', 'arg2');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('No placeholders');
    });
  });

  describe('timestamp formatting', () => {
    it('should include ISO timestamp in log output', () => {
      const logger = new Logger('info', false);
      const before = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

      logger.info('test message');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(call).toContain(before);
    });
  });

  describe('log level filtering', () => {
    it('should respect error level filtering', () => {
      const logger = new Logger('error', false);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });

    it('should respect warn level filtering', () => {
      const logger = new Logger('warn', false);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1); // warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });

    it('should respect info level filtering', () => {
      const logger = new Logger('info', false);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(2); // info, warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });

    it('should respect debug level filtering', () => {
      const logger = new Logger('debug', false);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(3); // debug, info, warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });
  });

  describe('silent mode', () => {
    it('should suppress all output when silent', () => {
      const logger = new Logger('debug', true);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should allow toggling silent mode', () => {
      const logger = new Logger('info', true);

      logger.info('silent message');
      expect(mockConsoleLog).not.toHaveBeenCalled();

      logger.setSilent(false);
      logger.info('visible message');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);

      logger.setSilent(true);
      logger.info('silent again');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logger.create static method', () => {
    it('should create logger with default parameters', () => {
      const logger = Logger.create();

      expect(logger).toBeInstanceOf(Logger);
      logger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should create logger with custom level', () => {
      const logger = Logger.create('error');

      logger.info('info message');
      logger.error('error message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should create logger with silent mode', () => {
      const logger = Logger.create('info', true);

      logger.info('test message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should create logger with both parameters', () => {
      const logger = Logger.create('debug', false);

      logger.debug('debug message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('defaultLogger', () => {
    it('should be an instance of Logger', () => {
      expect(defaultLogger).toBeInstanceOf(Logger);
    });

    it('should work with default settings', () => {
      defaultLogger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('color codes', () => {
    it('should use correct ANSI color codes', () => {
      const logger = new Logger('debug', false);

      logger.error('error');
      logger.warn('warn');
      logger.info('info');
      logger.debug('debug');

      const errorCall = mockConsoleError.mock.calls[0][0];
      const warnCall = mockConsoleLog.mock.calls[0][0];
      const infoCall = mockConsoleLog.mock.calls[1][0];
      const debugCall = mockConsoleLog.mock.calls[2][0];

      expect(errorCall).toContain('\x1b[31m'); // red
      expect(warnCall).toContain('\x1b[33m'); // yellow
      expect(infoCall).toContain('\x1b[34m'); // blue
      expect(debugCall).toContain('\x1b[2m'); // dim

      // All should have reset code
      expect(errorCall).toContain('\x1b[0m');
      expect(warnCall).toContain('\x1b[0m');
      expect(infoCall).toContain('\x1b[0m');
      expect(debugCall).toContain('\x1b[0m');
    });
  });

  describe('level padding', () => {
    it('should pad level names to consistent width', () => {
      const logger = new Logger('debug', false);

      logger.error('error');
      logger.warn('warn');
      logger.info('info');
      logger.debug('debug');

      const errorCall = mockConsoleError.mock.calls[0][0];
      const warnCall = mockConsoleLog.mock.calls[0][0];
      const infoCall = mockConsoleLog.mock.calls[1][0];
      const debugCall = mockConsoleLog.mock.calls[2][0];

      expect(errorCall).toContain('ERROR');
      expect(warnCall).toContain('WARN ');
      expect(infoCall).toContain('INFO ');
      expect(debugCall).toContain('DEBUG');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined and null arguments', () => {
      const logger = new Logger('info', false);

      logger.info('Value: %s, Number: %d', undefined, null);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Value: undefined, Number: 0');
    });

    it('should handle empty string arguments', () => {
      const logger = new Logger('info', false);

      logger.info('Empty: "%s"', '');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Empty: ""');
    });

    it('should handle complex objects in JSON formatting', () => {
      const logger = new Logger('info', false);
      const complexObj = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        nested: { key: 'nested value' },
      };

      logger.info('Complex: %j', complexObj);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('"string":"value"');
      expect(call).toContain('"number":42');
      expect(call).toContain('"boolean":true');
      expect(call).toContain('"null":null');
      expect(call).toContain('"array":[1,2,3]');
      expect(call).toContain('"nested":{"key":"nested value"}');
      expect(call).not.toContain('undefined'); // JSON.stringify omits undefined
    });

    it('should handle very long messages', () => {
      const logger = new Logger('info', false);
      const longMessage = 'a'.repeat(10000);

      logger.info(longMessage);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain(longMessage);
    });

    it('should handle %% placeholder to output literal % (line 103)', () => {
      const logger = new Logger('info', false);

      logger.info('Progress: %% complete', 50);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Progress: % complete');
    });

    it('should handle unknown placeholders with default case (line 104)', () => {
      const logger = new Logger('info', false);

      // Use an unknown placeholder that will hit the default case
      logger.info('Unknown: %x placeholder', 'value');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Unknown: %x placeholder'); // Should remain unchanged
    });

    it('should handle multiple %% placeholders (line 103)', () => {
      const logger = new Logger('info', false);

      logger.info('First %% and second %% placeholders');

      const call = mockConsoleLog.mock.calls[0][0];
      // The %% should be replaced with % in the formatted message
      expect(call).toContain('First % and second % placeholders');
    });

    it('should handle mix of valid and invalid placeholders (lines 103-104)', () => {
      const logger = new Logger('info', false);

      logger.info('Valid: %s, Invalid: %z, Percent: %%', 'test');

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('Valid: test, Invalid: %z, Percent: %');
    });

    it('should cover default case and return match for unknown placeholder patterns (lines 108-111)', () => {
      const logger = new Logger('info', false);

      // Test formatMessage directly to ensure lines 108-111 are covered
      const formatMessage = (logger as any).formatMessage;

      // Test with unknown placeholder patterns to hit default case (line 109)
      const result1 = formatMessage('Test: %x unknown', ['value']);
      expect(result1).toBe('Test: %x unknown');

      const result2 = formatMessage('Multiple: %z and %w unknowns', ['val1']);
      expect(result2).toBe('Multiple: %z and %w unknowns');

      // Test with multiple unknown patterns to verify return match (line 111)
      const result3 = formatMessage('Pattern: %a%b%c%d%e', []);
      expect(result3).toBe('Pattern: %a%b%c%d%e');
    });

    it('should specifically cover lines 108-111 - default case with break and return match', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test line 108 - break statement after switch inside %j case
      const result1 = formatMessage('JSON: %j', [{ test: 'value' }]);
      expect(result1).toBe('JSON: {"test":"value"}');

      // Test line 109 - default case: return match;
      const result2 = formatMessage('Unknown: %q placeholder', ['ignored']);
      expect(result2).toBe('Unknown: %q placeholder');

      // Test line 111 - return match; (outside switch, at end of replace function)
      const result3 = formatMessage('Mix: %s %q %d', ['text', 'ignored', 'notANumber']);
      expect(result3).toBe('Mix: text %q NaN');

      // Test various unknown placeholders to ensure default case is hit
      const unknownPlaceholders = [
        '%a',
        '%b',
        '%c',
        '%e',
        '%f',
        '%g',
        '%h',
        '%i',
        '%k',
        '%l',
        '%m',
        '%n',
        '%o',
        '%p',
        '%q',
        '%r',
        '%t',
        '%u',
        '%v',
        '%w',
        '%x',
        '%y',
        '%z',
      ];
      unknownPlaceholders.forEach((placeholder) => {
        const result = formatMessage(`Test ${placeholder} unknown`, []);
        expect(result).toBe(`Test ${placeholder} unknown`);
      });
    });

    it('should handle break statement after switch (line 108)', () => {
      const logger = new Logger('info', false);

      // Test with valid placeholders to ensure switch break works properly
      logger.info('String: %s, Number: %d', 'test', 123);

      const call = mockConsoleLog.mock.calls[0][0];
      expect(call).toContain('String: test, Number: 123');
    });
  });

  // Additional comprehensive coverage tests for lines 108-111
  describe('Complete Coverage for formatMessage lines 108-111', () => {
    it('should cover break statement after JSON.stringify case (line 108)', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test valid JSON formatting to ensure break statement is hit after JSON.stringify
      const result = formatMessage('JSON: %j valid', [{ test: 'value', number: 42 }]);
      expect(result).toBe('JSON: {"test":"value","number":42} valid');

      // Test circular JSON to ensure break after [Circular] case
      const circular: any = { prop: 'value' };
      circular.self = circular;
      const circularResult = formatMessage('Circular: %j test', [circular]);
      expect(circularResult).toBe('Circular: [Circular] test');
    });

    it('should hit default case and return match for unknown placeholders (line 109)', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test all possible unknown placeholder patterns to ensure default case is hit
      const unknownPlaceholders = [
        '%a',
        '%b',
        '%c',
        '%e',
        '%f',
        '%g',
        '%h',
        '%i',
        '%k',
        '%l',
        '%m',
        '%n',
        '%o',
        '%p',
        '%q',
        '%r',
        '%t',
        '%u',
        '%v',
        '%w',
        '%x',
        '%y',
        '%z',
        '%A',
        '%B',
        '%C',
        '%D',
        '%E',
        '%F',
        '%G',
        '%H',
        '%I',
        '%J',
        '%K',
        '%L',
        '%M',
        '%N',
        '%O',
        '%P',
        '%Q',
        '%R',
        '%S',
        '%T',
        '%U',
        '%V',
        '%W',
        '%X',
        '%Y',
        '%Z',
      ];

      unknownPlaceholders.forEach((placeholder) => {
        const result = formatMessage(`Test ${placeholder} unknown`, ['ignored-arg']);
        // Line 109: default: return match; should leave the placeholder unchanged
        expect(result).toBe(`Test ${placeholder} unknown`);
      });
    });

    it('should ensure line 111 return match is executed at end of replace function', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test mixed placeholders to ensure the final return match is hit for unknowns
      const result = formatMessage('Mix: %s known %q unknown %d known %r unknown', [
        'text',
        'ignored1',
        123,
        'ignored2',
      ]);

      // Known placeholders should be replaced, unknown ones should remain (line 111)
      expect(result).toBe('Mix: text known %q unknown NaN known %r unknown');
    });

    it('should comprehensively test all switch cases and default (lines 92-111)', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test each case in the switch statement
      const testCases = [
        // %% case (line 92)
        { input: 'Percent: %%', args: [], expected: 'Percent: %' },
        // %s case (line 93, 99)
        { input: 'String: %s', args: ['test'], expected: 'String: test' },
        // %d case (line 94, 100)
        { input: 'Number: %d', args: [42], expected: 'Number: 42' },
        { input: 'Number: %d', args: ['42'], expected: 'Number: 42' },
        { input: 'Number: %d', args: [null], expected: 'Number: 0' },
        // %j case (line 95, 101-106)
        { input: 'JSON: %j', args: [{ key: 'value' }], expected: 'JSON: {"key":"value"}' },
        // Unknown placeholder - default case (line 109)
        { input: 'Unknown: %z', args: ['ignored'], expected: 'Unknown: %z' },
      ];

      testCases.forEach((testCase) => {
        const result = formatMessage(testCase.input, testCase.args);
        expect(result).toBe(testCase.expected);
      });
    });

    it('should test break statements in all valid placeholder cases', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Ensure break statements work correctly for each case
      // Testing %% case break
      let result = formatMessage('Double %%%% percent', []);
      expect(result).toBe('Double %% percent');

      // Testing %s case break
      result = formatMessage('String %s test', ['value']);
      expect(result).toBe('String value test');

      // Testing %d case break
      result = formatMessage('Number %d test', [123]);
      expect(result).toBe('Number 123 test');

      // Testing %j case break (both success and circular paths)
      result = formatMessage('JSON %j test', [{ test: true }]);
      expect(result).toBe('JSON {"test":true} test');

      const circular: any = {};
      circular.ref = circular;
      result = formatMessage('Circular %j test', [circular]);
      expect(result).toBe('Circular [Circular] test');
    });

    it('should verify line 111 return match execution with complex patterns', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Create a complex string with mixed valid and invalid placeholders
      const complexPattern =
        'Start %s valid %% literal %q invalid %d valid %z invalid %j valid %w invalid end';
      const args = ['text', 42, { key: 'val' }];

      const result = formatMessage(complexPattern, args);

      // Valid placeholders should be replaced, invalid ones preserved (line 111)
      expect(result).toBe(
        'Start text valid % literal %q invalid 42 valid %z invalid {"key":"val"} valid %w invalid end'
      );
    });

    it('should ensure all code paths in formatMessage are covered', () => {
      const logger = new Logger('info', false);
      const formatMessage = (logger as any).formatMessage;

      // Test edge cases that exercise all branches

      // Empty args array with placeholders (line 96)
      let result = formatMessage('No args: %s %d %j', []);
      expect(result).toBe('No args: %s %d %j');

      // Args consumed during replacement
      result = formatMessage('Consume: %s %s %s', ['first', 'second']);
      expect(result).toBe('Consume: first second %s');

      // Multiple unknown placeholders
      result = formatMessage('Multi unknown: %a %b %c', ['arg1', 'arg2', 'arg3']);
      expect(result).toBe('Multi unknown: %a %b %c');

      // Mix of all cases
      result = formatMessage('All: %% %s %d %j %x', ['str', 123, { obj: true }]);
      expect(result).toBe('All: % str 123 {"obj":true} %x');
    });
  });
});
