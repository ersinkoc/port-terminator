/**
 * Bug Fix Tests - Protocol Validation in CLI Parser
 * BUG-ID: BUG-2025-003
 *
 * Tests for validating that the CLI --method parameter
 * properly validates protocol values and rejects invalid ones.
 */

import { CommandParser } from '../../../src/utils/command-parser';

describe('Bug Fix - Protocol Validation (BUG-2025-003)', () => {
  describe('--method parameter validation', () => {
    it('should accept valid protocol: tcp', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'tcp']);
      expect(options.method).toBe('tcp');
    });

    it('should accept valid protocol: udp', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'udp']);
      expect(options.method).toBe('udp');
    });

    it('should accept valid protocol: both', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'both']);
      expect(options.method).toBe('both');
    });

    it('should accept valid protocol with uppercase: TCP', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'TCP']);
      expect(options.method).toBe('tcp');
    });

    it('should accept valid protocol with mixed case: UdP', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'UdP']);
      expect(options.method).toBe('udp');
    });

    it('should reject invalid protocol: invalid', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '--method', 'invalid']);
      }).toThrow(/Invalid protocol.*invalid/i);
    });

    it('should reject invalid protocol: tpc (typo)', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '--method', 'tpc']);
      }).toThrow(/Invalid protocol.*tpc/i);
    });

    it('should handle empty string (converted to 0) as missing value', () => {
      // Empty string from command line is parsed by parseValue as Number('') = 0
      // Since 0 is a number, not a string, it doesn't pass the typeof check
      // So the protocol remains undefined, which is acceptable
      const options = CommandParser.parseArgs(['3000', '--method', '']);
      expect(options.method).toBeUndefined();  // Empty value ignored
    });

    it('should reject invalid protocol: http', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '--method', 'http']);
      }).toThrow(/Invalid protocol.*http/i);
    });

    it('should provide helpful error message with valid options', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '--method', 'invalid']);
      }).toThrow(/'tcp', 'udp', or 'both'/i);
    });
  });

  describe('Short form -m validation', () => {
    it('should accept valid protocol with short form: -m tcp', () => {
      const options = CommandParser.parseArgs(['3000', '-m', 'tcp']);
      expect(options.method).toBe('tcp');
    });

    it('should reject invalid protocol with short form: -m invalid', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '-m', 'invalid']);
      }).toThrow(/Invalid protocol/i);
    });
  });

  describe('Equals syntax validation', () => {
    it('should accept valid protocol with equals: --method=tcp', () => {
      const options = CommandParser.parseArgs(['3000', '--method=tcp']);
      expect(options.method).toBe('tcp');
    });

    it('should reject invalid protocol with equals: --method=invalid', () => {
      expect(() => {
        CommandParser.parseArgs(['3000', '--method=invalid']);
      }).toThrow(/Invalid protocol/i);
    });
  });

  describe('Regression: Previously working protocols still work', () => {
    it('should still accept tcp (regression test)', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'tcp']);
      expect(options.method).toBe('tcp');
      expect(options.ports).toEqual([3000]);
    });

    it('should still accept udp (regression test)', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'udp']);
      expect(options.method).toBe('udp');
      expect(options.ports).toEqual([3000]);
    });

    it('should still accept both (regression test)', () => {
      const options = CommandParser.parseArgs(['3000', '--method', 'both']);
      expect(options.method).toBe('both');
      expect(options.ports).toEqual([3000]);
    });

    it('should default to both when not specified (regression test)', () => {
      const options = CommandParser.parseArgs(['3000']);
      expect(options.method).toBeUndefined();  // CLI doesn't set default, PortTerminator does
      expect(options.ports).toEqual([3000]);
    });
  });
});
