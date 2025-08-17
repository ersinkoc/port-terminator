import { CommandParser } from '../../../src/utils/command-parser';
import { InvalidPortError } from '../../../src/errors';

describe('CommandParser', () => {
  describe('constructor', () => {
    it('should use process.argv.slice(2) by default', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--help', '3000'];

      const parser = new CommandParser();
      const options = parser.parse();

      expect(options.help).toBe(true);
      expect(options.ports).toEqual([3000]);

      process.argv = originalArgv;
    });

    it('should use provided args', () => {
      const parser = new CommandParser(['--version', '8080']);
      const options = parser.parse();

      expect(options.version).toBe(true);
      expect(options.ports).toEqual([8080]);
    });

    it('should handle empty args', () => {
      const parser = new CommandParser([]);
      const options = parser.parse();

      expect(options).toEqual({});
    });
  });

  describe('boolean flags', () => {
    it('should parse help flags', () => {
      expect(new CommandParser(['--help']).parse().help).toBe(true);
      expect(new CommandParser(['-h']).parse().help).toBe(true);
    });

    it('should parse version flags', () => {
      expect(new CommandParser(['--version']).parse().version).toBe(true);
      expect(new CommandParser(['-v']).parse().version).toBe(true);
    });

    it('should parse force flags', () => {
      expect(new CommandParser(['--force']).parse().force).toBe(true);
      expect(new CommandParser(['-f']).parse().force).toBe(true);
    });

    it('should parse silent flags', () => {
      expect(new CommandParser(['--silent']).parse().silent).toBe(true);
      expect(new CommandParser(['-s']).parse().silent).toBe(true);
    });

    it('should parse dry-run flags', () => {
      expect(new CommandParser(['--dry-run']).parse().dryRun).toBe(true);
      expect(new CommandParser(['-n']).parse().dryRun).toBe(true);
    });

    it('should parse json flags', () => {
      expect(new CommandParser(['--json']).parse().json).toBe(true);
      expect(new CommandParser(['-j']).parse().json).toBe(true);
    });

    it('should handle multiple boolean flags', () => {
      const options = new CommandParser(['--help', '--version', '--force']).parse();

      expect(options.help).toBe(true);
      expect(options.version).toBe(true);
      expect(options.force).toBe(true);
    });

    it('should handle combined short flags', () => {
      const options = new CommandParser(['-hvf']).parse();

      expect(options.help).toBe(true);
      expect(options.version).toBe(true);
      expect(options.force).toBe(true);
    });
  });

  describe('value flags', () => {
    it('should parse timeout with equals', () => {
      const options = new CommandParser(['--timeout=5000']).parse();
      expect(options.timeout).toBe(5000);
    });

    it('should parse timeout with space', () => {
      const options = new CommandParser(['--timeout', '10000']).parse();
      expect(options.timeout).toBe(10000);
    });

    it('should parse timeout with short flag', () => {
      const options = new CommandParser(['-t', '15000']).parse();
      expect(options.timeout).toBe(15000);
    });

    it('should parse graceful-timeout', () => {
      expect(new CommandParser(['--graceful-timeout=3000']).parse().gracefulTimeout).toBe(3000);
      expect(new CommandParser(['--graceful-timeout', '4000']).parse().gracefulTimeout).toBe(4000);
      expect(new CommandParser(['-g', '5000']).parse().gracefulTimeout).toBe(5000);
    });

    it('should parse method', () => {
      expect(new CommandParser(['--method=tcp']).parse().method).toBe('tcp');
      expect(new CommandParser(['--method', 'udp']).parse().method).toBe('udp');
      expect(new CommandParser(['-m', 'both']).parse().method).toBe('both');
    });

    it('should parse range', () => {
      expect(new CommandParser(['--range=3000-3005']).parse().range).toBe('3000-3005');
      expect(new CommandParser(['--range', '8000-8010']).parse().range).toBe('8000-8010');
      expect(new CommandParser(['-r', '9000-9005']).parse().range).toBe('9000-9005');
    });

    it('should handle string values', () => {
      const options = new CommandParser(['--method', 'tcp']).parse();
      expect(typeof options.method).toBe('string');
      expect(options.method).toBe('tcp');
    });

    it('should handle numeric values', () => {
      const options = new CommandParser(['--timeout', '5000']).parse();
      expect(typeof options.timeout).toBe('number');
      expect(options.timeout).toBe(5000);
    });

    it('should handle boolean string values', () => {
      const parser = new CommandParser(['--custom', 'true']);
      // Since 'custom' isn't a recognized flag, it won't be parsed
      const options = parser.parse();
      expect((options as any).custom).toBeUndefined();
    });
  });

  describe('port parsing', () => {
    it('should parse single port', () => {
      const options = new CommandParser(['3000']).parse();
      expect(options.ports).toEqual([3000]);
    });

    it('should parse multiple ports', () => {
      const options = new CommandParser(['3000', '8080', '9000']).parse();
      expect(options.ports).toEqual([3000, 8080, 9000]);
    });

    it('should parse ports with flags', () => {
      const options = new CommandParser(['--force', '3000', '--silent', '8080']).parse();
      expect(options.ports).toEqual([3000, 8080]);
      expect(options.force).toBe(true);
      expect(options.silent).toBe(true);
    });

    it('should handle invalid port numbers', () => {
      const options = new CommandParser(['3000', 'invalid', '8080']).parse();
      expect(options.ports).toEqual([3000, 8080]);
    });

    it('should handle string port numbers', () => {
      const options = new CommandParser(['3000']).parse();
      expect(options.ports).toEqual([3000]);
    });
  });

  describe('range parsing', () => {
    it('should parse port range', () => {
      const options = new CommandParser(['--range', '3000-3005']).parse();
      expect(options.range).toBe('3000-3005');
      expect(options.ports).toEqual([3000, 3001, 3002, 3003, 3004, 3005]);
    });

    it('should combine range with individual ports', () => {
      const options = new CommandParser(['--range', '3000-3002', '8080']).parse();
      expect(options.ports).toEqual([3000, 3001, 3002, 8080]);
    });

    it('should handle multiple ranges (last range value set, but all ports added)', () => {
      const options = new CommandParser(['--range', '3000-3002', '--range', '8000-8001']).parse();
      expect(options.range).toBe('8000-8001');
      expect(options.ports).toEqual([3000, 3001, 3002, 8000, 8001]);
    });

    it('should handle range values that parse as numbers', () => {
      // When a range value like '3000' gets parsed as a number, it won't match the string type check
      const options1 = new CommandParser(['--range', '3000']).parse();
      expect(options1.range).toBeUndefined(); // Parsed as number, not string

      // But string values with hyphens stay as strings, though invalid ranges will throw
      expect(() => new CommandParser(['--range', '3000-3002-3005']).parse()).toThrow(
        'Invalid port range'
      );
    });

    it('should throw on invalid port in range', () => {
      expect(() => new CommandParser(['--range', '0-5']).parse()).toThrow(InvalidPortError);
      expect(() => new CommandParser(['--range', '3000-70000']).parse()).toThrow(InvalidPortError);
    });
  });

  describe('complex scenarios', () => {
    it('should parse complex command line', () => {
      const args = [
        '--force',
        '--timeout',
        '10000',
        '-g',
        '2000',
        '--method=tcp',
        '--range',
        '3000-3002',
        '8080',
        '--silent',
      ];

      const options = new CommandParser(args).parse();

      expect(options.force).toBe(true);
      expect(options.timeout).toBe(10000);
      expect(options.gracefulTimeout).toBe(2000);
      expect(options.method).toBe('tcp');
      expect(options.range).toBe('3000-3002');
      expect(options.ports).toEqual([3000, 3001, 3002, 8080]);
      expect(options.silent).toBe(true);
    });

    it('should handle mixed short and long flags', () => {
      const args = ['-fvs', '--timeout=5000', '3000'];
      const options = new CommandParser(args).parse();

      expect(options.force).toBe(true);
      expect(options.version).toBe(true);
      expect(options.silent).toBe(true);
      expect(options.timeout).toBe(5000);
      expect(options.ports).toEqual([3000]);
    });

    it('should handle combined short flags with value', () => {
      const args = ['-fst', '3000', '8080'];
      const options = new CommandParser(args).parse();

      expect(options.force).toBe(true);
      expect(options.silent).toBe(true);
      expect(options.timeout).toBe(3000);
      expect(options.ports).toEqual([8080]);
    });

    it('should handle flags without values when expected', () => {
      const args = ['--timeout', '--force'];
      const options = new CommandParser(args).parse();

      expect(options.timeout).toBeUndefined(); // timeout expects a value but got a flag
      expect(options.force).toBe(true);
    });

    it('should handle flags at end of arguments', () => {
      const args = ['3000', '--force'];
      const options = new CommandParser(args).parse();

      expect(options.ports).toEqual([3000]);
      expect(options.force).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string arguments', () => {
      const options = new CommandParser(['', '3000', '']).parse();
      expect(options.ports).toEqual([3000]);
    });

    it('should handle dash as argument', () => {
      const options = new CommandParser(['-', '3000']).parse();
      expect(options.ports).toEqual([3000]);
    });

    it('should handle double dash', () => {
      const options = new CommandParser(['--', '3000']).parse();
      // Double dash consumes next argument as its value, so 3000 doesn't get parsed as port
      expect(options.ports).toBeUndefined();
    });

    it('should handle single character flags', () => {
      const options = new CommandParser(['-a']).parse();
      // 'a' is not a recognized flag, so it should be treated as unknown
      expect(Object.keys(options)).toHaveLength(0);
    });

    it('should handle unknown long flags', () => {
      const options = new CommandParser(['--unknown', 'value']).parse();
      expect((options as any).unknown).toBeUndefined();
    });

    it('should handle numeric-like strings that are not ports', () => {
      const options = new CommandParser(['3000.5', '3000e5', '3000x']).parse();
      // 3000.5 fails due to decimal check, but 3000e5 and 3000x parse as 3000 via parseInt
      expect(options.ports).toEqual([3000, 3000]);
    });

    it('should handle very large numbers', () => {
      const options = new CommandParser(['99999999999999']).parse();
      // This is outside valid port range
      expect(options.ports).toBeUndefined();
    });

    it('should handle negative numbers', () => {
      const options = new CommandParser(['-1000']).parse();
      // This should be treated as a flag, not a port
      expect(options.ports).toBeUndefined();
    });
  });

  describe('value parsing', () => {
    it('should parse numeric strings as numbers', () => {
      const parser = new CommandParser();
      const parseValue = (parser as any).parseValue;

      expect(parseValue('123')).toBe(123);
      expect(parseValue('0')).toBe(0);
      expect(parseValue('3.14')).toBe(3.14);
    });

    it('should parse boolean strings', () => {
      const parser = new CommandParser();
      const parseValue = (parser as any).parseValue;

      expect(parseValue('true')).toBe(true);
      expect(parseValue('false')).toBe(false);
    });

    it('should keep strings as strings', () => {
      const parser = new CommandParser();
      const parseValue = (parser as any).parseValue;

      expect(parseValue('hello')).toBe('hello');
      expect(parseValue('tcp')).toBe('tcp');
      expect(parseValue('')).toBe(0); // Empty string becomes 0 via Number()
    });

    it('should handle special numeric cases', () => {
      const parser = new CommandParser();
      const parseValue = (parser as any).parseValue;

      // Infinity is not finite, so it returns as string
      expect(parseValue('Infinity')).toBe('Infinity');
      expect(parseValue('-Infinity')).toBe('-Infinity');
      // NaN is not finite, so it returns as string
      expect(parseValue('NaN')).toBe('NaN');
    });
  });

  describe('static parseArgs method', () => {
    it('should parse args using static method', () => {
      const options = CommandParser.parseArgs(['--help', '3000']);

      expect(options.help).toBe(true);
      expect(options.ports).toEqual([3000]);
    });

    it('should use process.argv by default', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--version'];

      const options = CommandParser.parseArgs();
      expect(options.version).toBe(true);

      process.argv = originalArgv;
    });

    it('should handle empty args', () => {
      const options = CommandParser.parseArgs([]);
      expect(options).toEqual({});
    });
  });

  describe('private methods', () => {
    it('should identify boolean flags correctly', () => {
      const parser = new CommandParser();
      const isBooleanFlag = (parser as any).isBooleanFlag;

      expect(isBooleanFlag('help')).toBe(true);
      expect(isBooleanFlag('h')).toBe(true);
      expect(isBooleanFlag('version')).toBe(true);
      expect(isBooleanFlag('v')).toBe(true);
      expect(isBooleanFlag('force')).toBe(true);
      expect(isBooleanFlag('f')).toBe(true);
      expect(isBooleanFlag('silent')).toBe(true);
      expect(isBooleanFlag('s')).toBe(true);
      expect(isBooleanFlag('dry-run')).toBe(true);
      expect(isBooleanFlag('n')).toBe(true);
      expect(isBooleanFlag('json')).toBe(true);
      expect(isBooleanFlag('j')).toBe(true);

      expect(isBooleanFlag('timeout')).toBe(false);
      expect(isBooleanFlag('method')).toBe(false);
      expect(isBooleanFlag('unknown')).toBe(false);
    });

    it('should map short flags correctly', () => {
      const parser = new CommandParser();
      const getShortFlagName = (parser as any).getShortFlagName;

      expect(getShortFlagName('h')).toBe('help');
      expect(getShortFlagName('v')).toBe('version');
      expect(getShortFlagName('f')).toBe('force');
      expect(getShortFlagName('s')).toBe('silent');
      expect(getShortFlagName('n')).toBe('dry-run');
      expect(getShortFlagName('j')).toBe('json');
      expect(getShortFlagName('t')).toBe('timeout');
      expect(getShortFlagName('g')).toBe('graceful-timeout');
      expect(getShortFlagName('m')).toBe('method');
      expect(getShortFlagName('r')).toBe('range');

      expect(getShortFlagName('x')).toBe('x'); // unknown flag returns itself
    });

    it('should parse port values correctly', () => {
      const parser = new CommandParser();
      const parsePortValue = (parser as any).parsePortValue;

      expect(parsePortValue('3000')).toBe(3000);
      expect(parsePortValue('65535')).toBe(65535);
      expect(parsePortValue('1')).toBe(1);

      expect(parsePortValue('0')).toBeNull();
      expect(parsePortValue('70000')).toBeNull();
      expect(parsePortValue('invalid')).toBeNull();
      expect(parsePortValue('-1')).toBeNull();
    });
  });

  describe('argument parsing edge cases', () => {
    it('should handle equals sign in long arguments', () => {
      const options = new CommandParser(['--method=tcp=udp']).parse();
      expect(options.method).toBe('tcp=udp');
    });

    it('should handle multiple equals signs', () => {
      const options = new CommandParser(['--method=key=value=extra']).parse();
      expect(options.method).toBe('key=value=extra');
    });

    it('should handle empty value after equals', () => {
      const options = new CommandParser(['--method=']).parse();
      // Empty value gets parsed as 0 by parseValue, but method expects string
      // Since switch case only handles 'string' type, it gets ignored
      expect(options.method).toBeUndefined();
    });

    it('should handle whitespace in arguments', () => {
      const options = new CommandParser(['  --help  ', '  3000  ']).parse();
      // Flags with whitespace are not recognized, but ports can have whitespace (parseInt ignores it)
      expect(options.help).toBeUndefined();
      expect(options.ports).toEqual([3000]);
    });

    it('should handle combined flags with trailing value flag', () => {
      const options = new CommandParser(['-fst', '5000', '3000']).parse();
      expect(options.force).toBe(true);
      expect(options.silent).toBe(true);
      expect(options.timeout).toBe(5000);
      expect(options.ports).toEqual([3000]);
    });

    it('should handle combined flags where last is not value flag', () => {
      const options = new CommandParser(['-fsv', '3000']).parse();
      expect(options.force).toBe(true);
      expect(options.silent).toBe(true);
      expect(options.version).toBe(true);
      expect(options.ports).toEqual([3000]);
    });
  });
});
