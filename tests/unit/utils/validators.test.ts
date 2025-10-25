import {
  validatePort,
  validatePorts,
  validateTimeout,
  parsePortRange,
  isValidProtocol,
  normalizeProtocol,
} from '../../../src/utils/validators';
import { InvalidPortError } from '../../../src/errors';

describe('validators', () => {
  describe('validatePort', () => {
    it('should validate valid port numbers', () => {
      expect(validatePort(80)).toBe(80);
      expect(validatePort(3000)).toBe(3000);
      expect(validatePort(65535)).toBe(65535);
      expect(validatePort(1)).toBe(1);
    });

    it('should validate string port numbers', () => {
      expect(validatePort('80')).toBe(80);
      expect(validatePort('3000')).toBe(3000);
    });

    it('should throw InvalidPortError for invalid ports', () => {
      expect(() => validatePort(0)).toThrow(InvalidPortError);
      expect(() => validatePort(-1)).toThrow(InvalidPortError);
      expect(() => validatePort(65536)).toThrow(InvalidPortError);
      expect(() => validatePort(NaN)).toThrow(InvalidPortError);
      expect(() => validatePort(Infinity)).toThrow(InvalidPortError);
      expect(() => validatePort('invalid')).toThrow(InvalidPortError);
      expect(() => validatePort('80.5')).toThrow(InvalidPortError);
    });

    it('should include port in error message', () => {
      try {
        validatePort(0);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPortError);
        expect((error as InvalidPortError).port).toBe(0);
        expect((error as InvalidPortError).message).toContain('0');
      }
    });

    it('should include the original port string in the error for out-of-range strings', () => {
      try {
        validatePort('65536');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPortError);
        expect((error as InvalidPortError).port).toBe('65536');
        expect((error as InvalidPortError).message).toContain('65536');
      }
    });
  });

  describe('validatePorts', () => {
    it('should validate array of valid ports', () => {
      const result = validatePorts([80, 3000, '8080']);
      expect(result).toEqual([80, 3000, 8080]);
    });

    it('should throw InvalidPortError for any invalid port', () => {
      expect(() => validatePorts([80, 0, 3000])).toThrow(InvalidPortError);
      expect(() => validatePorts(['80', 'invalid', '3000'])).toThrow(InvalidPortError);
    });

    it('should handle empty array', () => {
      expect(validatePorts([])).toEqual([]);
    });
  });

  describe('validateTimeout', () => {
    it('should validate positive timeout values', () => {
      expect(validateTimeout(1000)).toBe(1000);
      expect(validateTimeout(0)).toBe(0);
      expect(validateTimeout(30000)).toBe(30000);
    });

    it('should throw error for negative timeouts', () => {
      expect(() => validateTimeout(-1)).toThrow('Invalid timeout: -1');
      expect(() => validateTimeout(-1000)).toThrow('Invalid timeout: -1000');
    });

    it('should throw error for infinite timeouts', () => {
      expect(() => validateTimeout(Infinity)).toThrow('Invalid timeout: Infinity');
      expect(() => validateTimeout(-Infinity)).toThrow('Invalid timeout: -Infinity');
    });
  });

  describe('parsePortRange', () => {
    it('should parse valid port ranges', () => {
      expect(parsePortRange('3000-3005')).toEqual([3000, 3001, 3002, 3003, 3004, 3005]);
      expect(parsePortRange('80-82')).toEqual([80, 81, 82]);
      expect(parsePortRange('8080-8080')).toEqual([8080]);
    });

    it('should handle whitespace in range', () => {
      expect(parsePortRange(' 3000 - 3002 ')).toEqual([3000, 3001, 3002]);
    });

    it('should throw error for invalid range format', () => {
      expect(() => parsePortRange('3000')).toThrow('Invalid port range: 3000');
      expect(() => parsePortRange('3000-3002-3004')).toThrow('Invalid port range: 3000-3002-3004');
      expect(() => parsePortRange('')).toThrow('Invalid port range: ');
    });

    it('should throw error for invalid port numbers in range', () => {
      expect(() => parsePortRange('0-5')).toThrow(InvalidPortError);
      expect(() => parsePortRange('3000-70000')).toThrow(InvalidPortError);
      expect(() => parsePortRange('invalid-3000')).toThrow(InvalidPortError);
    });

    it('should throw error when start port is greater than end port', () => {
      expect(() => parsePortRange('3005-3000')).toThrow('Invalid port range: 3005-3000');
    });
  });

  describe('isValidProtocol', () => {
    it('should validate valid protocols', () => {
      expect(isValidProtocol('tcp')).toBe(true);
      expect(isValidProtocol('udp')).toBe(true);
      expect(isValidProtocol('both')).toBe(true);
      expect(isValidProtocol('TCP')).toBe(true);
      expect(isValidProtocol('UDP')).toBe(true);
      expect(isValidProtocol('BOTH')).toBe(true);
    });

    it('should reject invalid protocols', () => {
      expect(isValidProtocol('http')).toBe(false);
      expect(isValidProtocol('invalid')).toBe(false);
      expect(isValidProtocol('')).toBe(false);
      expect(isValidProtocol('tcpudp')).toBe(false);
    });
  });

  describe('normalizeProtocol', () => {
    it('should normalize valid protocols', () => {
      expect(normalizeProtocol('tcp')).toBe('tcp');
      expect(normalizeProtocol('UDP')).toBe('udp');
      expect(normalizeProtocol('Both')).toBe('both');
      expect(normalizeProtocol('TCP')).toBe('tcp');
    });

    it('should default to both when undefined', () => {
      expect(normalizeProtocol()).toBe('both');
      expect(normalizeProtocol(undefined)).toBe('both');
    });

    it('should throw error for invalid protocols', () => {
      expect(() => normalizeProtocol('invalid')).toThrow('Invalid protocol: invalid');
      expect(() => normalizeProtocol('http')).toThrow('Invalid protocol: http');
      expect(() => normalizeProtocol('')).toThrow('Invalid protocol: ');
    });
  });
});
