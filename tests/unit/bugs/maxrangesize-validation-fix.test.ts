/**
 * Test suite for BUG-2025-007: Missing Validation for maxRangeSize Parameter
 *
 * Bug Description:
 * The parsePortRange function doesn't validate the maxRangeSize parameter.
 * Invalid values (negative, zero, NaN, Infinity) could bypass range limits
 * or cause unexpected behavior.
 *
 * Impact:
 * - maxRangeSize = -1 or 0: All ranges rejected
 * - maxRangeSize = NaN: No limit enforced (comparison always false)
 * - maxRangeSize = Infinity: No limit enforced
 *
 * Fix:
 * Validate that maxRangeSize is a positive integer and finite.
 */

import { parsePortRange } from '../../../src/utils/validators';

describe('BUG-2025-007: maxRangeSize Validation Fix', () => {
  describe('Valid maxRangeSize values', () => {
    it('should accept default maxRangeSize=1000', () => {
      const ports = parsePortRange('1-100');
      expect(ports).toHaveLength(100);
      expect(ports[0]).toBe(1);
      expect(ports[99]).toBe(100);
    });

    it('should accept custom positive maxRangeSize', () => {
      const ports = parsePortRange('1-50', 50);
      expect(ports).toHaveLength(50);
    });

    it('should accept large maxRangeSize', () => {
      const ports = parsePortRange('1-5000', 10000);
      expect(ports).toHaveLength(5000);
    });

    it('should enforce maxRangeSize limit correctly', () => {
      expect(() => {
        parsePortRange('1-1001', 1000);
      }).toThrow('Port range too large');
    });
  });

  describe('Invalid maxRangeSize values should be rejected', () => {
    it('should reject negative maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', -1);
      }).toThrow('Invalid maxRangeSize: -1. Must be a positive integer');
    });

    it('should reject zero maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', 0);
      }).toThrow('Invalid maxRangeSize: 0. Must be a positive integer');
    });

    it('should reject NaN maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', NaN);
      }).toThrow('Invalid maxRangeSize: NaN. Must be a positive integer');
    });

    it('should reject Infinity maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', Infinity);
      }).toThrow('Invalid maxRangeSize: Infinity. Must be a positive integer');
    });

    it('should reject negative Infinity maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', -Infinity);
      }).toThrow('Invalid maxRangeSize: -Infinity. Must be a positive integer');
    });

    it('should reject decimal maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', 10.5);
      }).toThrow('Invalid maxRangeSize: 10.5. Must be a positive integer');
    });

    it('should reject negative decimal maxRangeSize', () => {
      expect(() => {
        parsePortRange('1-10', -5.5);
      }).toThrow('Invalid maxRangeSize: -5.5. Must be a positive integer');
    });
  });

  describe('Edge cases', () => {
    it('should allow maxRangeSize=1 for single port range', () => {
      const ports = parsePortRange('100-100', 1);
      expect(ports).toEqual([100]);
    });

    it('should reject range larger than maxRangeSize=1', () => {
      expect(() => {
        parsePortRange('100-101', 1);
      }).toThrow('Port range too large: 2 ports. Maximum allowed: 1');
    });

    it('should handle exact limit', () => {
      const ports = parsePortRange('1-100', 100);
      expect(ports).toHaveLength(100);
    });

    it('should reject one over limit', () => {
      expect(() => {
        parsePortRange('1-101', 100);
      }).toThrow('Port range too large: 101 ports. Maximum allowed: 100');
    });
  });

  describe('Regression tests - existing behavior preserved', () => {
    it('should still reject invalid range format', () => {
      expect(() => {
        parsePortRange('invalid', 1000);
      }).toThrow('Invalid port range');
    });

    it('should still reject invalid port numbers', () => {
      expect(() => {
        parsePortRange('abc-def', 1000);
      }).toThrow('Invalid port number');
    });

    it('should still reject start > end', () => {
      expect(() => {
        parsePortRange('100-50', 1000);
      }).toThrow('Start port must be less than or equal to end port');
    });

    it('should still handle whitespace correctly', () => {
      const ports = parsePortRange(' 1 - 5 ', 10);
      expect(ports).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Security implications', () => {
    it('should prevent bypassing limit with NaN', () => {
      // Before fix: NaN comparison would allow any range size
      expect(() => {
        parsePortRange('1-65535', NaN);
      }).toThrow('Invalid maxRangeSize');
    });

    it('should prevent bypassing limit with Infinity', () => {
      // Before fix: Infinity would allow any range size
      expect(() => {
        parsePortRange('1-65535', Infinity);
      }).toThrow('Invalid maxRangeSize');
    });

    it('should prevent denial-of-service with negative value', () => {
      // Before fix: Negative value would reject all ranges
      expect(() => {
        parsePortRange('1-10', -1);
      }).toThrow('Invalid maxRangeSize');
    });
  });
});
