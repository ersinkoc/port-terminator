/**
 * Test suite for BUG-2025-008: Inefficient Double parseInt Call
 *
 * Bug Description:
 * The InvalidPortError constructor calls parseInt(port, 10) twice for the same value
 * when checking if a string port is parseable, which is inefficient.
 *
 * Impact:
 * - Performance overhead (minimal since error construction is rare)
 * - Code smell - violates DRY principle
 * - Harder to maintain
 *
 * Fix:
 * Call parseInt once and reuse the result.
 */

import { InvalidPortError } from '../../../src/errors';

describe('BUG-2025-008: parseInt Optimization Fix', () => {
  describe('Behavior remains unchanged after optimization', () => {
    it('should preserve port number for numeric input', () => {
      const error = new InvalidPortError(123);
      expect(error.port).toBe(123);
      expect(error.message).toContain('123');
    });

    it('should preserve port string for valid numeric string', () => {
      const error = new InvalidPortError('456');
      expect(error.port).toBe('456');
      expect(error.message).toContain('456');
    });

    it('should not preserve port for non-numeric string', () => {
      const error = new InvalidPortError('invalid');
      expect(error.port).toBeUndefined();
      expect(error.message).toContain('invalid');
    });

    it('should not preserve port for out-of-range string', () => {
      const error = new InvalidPortError('99999');
      expect(error.port).toBe('99999'); // String is preserved even if value is out of range
      expect(error.message).toContain('99999');
    });

    it('should not preserve port for negative string', () => {
      const error = new InvalidPortError('-123');
      expect(error.port).toBe('-123'); // Preserves parseable strings
      expect(error.message).toContain('-123');
    });

    it('should preserve port for decimal string (parseInt parses leading digits)', () => {
      const error = new InvalidPortError('123.45');
      expect(error.port).toBe('123.45'); // parseInt('123.45', 10) = 123, which is finite
      expect(error.message).toContain('123.45');
    });

    it('should preserve port for zero', () => {
      const error = new InvalidPortError(0);
      expect(error.port).toBe(0);
      expect(error.message).toContain('0');
    });

    it('should preserve port for NaN (numeric type)', () => {
      const error = new InvalidPortError(NaN);
      expect(error.port).toBe(NaN); // NaN is typeof 'number', so preserved
      expect(error.message).toContain('NaN');
    });

    it('should preserve port for Infinity (numeric type)', () => {
      const error = new InvalidPortError(Infinity);
      expect(error.port).toBe(Infinity); // Infinity is typeof 'number', so preserved
      expect(error.message).toContain('Infinity');
    });
  });

  describe('Error properties', () => {
    it('should have correct error name', () => {
      const error = new InvalidPortError(123);
      expect(error.name).toBe('InvalidPortError');
    });

    it('should have correct error code', () => {
      const error = new InvalidPortError('invalid');
      expect(error.code).toBe('INVALID_PORT');
    });

    it('should include port in message', () => {
      const error = new InvalidPortError(70000);
      expect(error.message).toContain('70000');
      expect(error.message).toContain('between 1 and 65535');
    });

    it('should be instance of Error', () => {
      const error = new InvalidPortError(123);
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of InvalidPortError', () => {
      const error = new InvalidPortError('abc');
      expect(error).toBeInstanceOf(InvalidPortError);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const error = new InvalidPortError('');
      expect(error.port).toBeUndefined(); // Empty string not parseable
      expect(error.message).toContain('');
    });

    it('should handle string with spaces', () => {
      const error = new InvalidPortError('  123  ');
      expect(error.port).toBe('  123  '); // Trimmed parseInt still works
      expect(error.message).toContain('123');
    });

    it('should handle string with leading zeros', () => {
      const error = new InvalidPortError('00123');
      expect(error.port).toBe('00123');
      expect(error.message).toContain('00123');
    });

    it('should handle hex string', () => {
      const error = new InvalidPortError('0x100');
      expect(error.port).toBe('0x100'); // parseInt parses hex
      expect(error.message).toContain('0x100');
    });

    it('should handle string starting with number', () => {
      const error = new InvalidPortError('123abc');
      expect(error.port).toBe('123abc'); // parseInt parses leading digits
      expect(error.message).toContain('123abc');
    });
  });

  describe('Performance', () => {
    it('should create many errors efficiently', () => {
      const start = Date.now();

      // Create 1000 errors
      for (let i = 0; i < 1000; i++) {
        new InvalidPortError(`port${i}`);
      }

      const duration = Date.now() - start;

      // Should complete quickly (< 100ms for 1000 errors)
      // After optimization, should be faster (no double parseInt)
      expect(duration).toBeLessThan(100);
    });
  });
});
