import { validateTimeout } from '../../../src/utils/validators';

describe('Bug #3 Fix: validateTimeout Error Message', () => {
  it('should accept timeout=0 (non-negative)', () => {
    // Before fix: Error message said "must be a positive number" but function accepts 0
    // After fix: Error message correctly says "must be a non-negative number"

    expect(() => validateTimeout(0)).not.toThrow();
    expect(validateTimeout(0)).toBe(0);
  });

  it('should reject negative timeouts with correct error message', () => {
    expect(() => validateTimeout(-1)).toThrow('Timeout must be a non-negative number');
    expect(() => validateTimeout(-100)).toThrow('Timeout must be a non-negative number');
  });

  it('should accept positive timeouts', () => {
    expect(validateTimeout(1)).toBe(1);
    expect(validateTimeout(1000)).toBe(1000);
    expect(validateTimeout(30000)).toBe(30000);
  });

  it('should reject non-finite timeouts with correct error message', () => {
    expect(() => validateTimeout(Infinity)).toThrow('Timeout must be a non-negative number');
    expect(() => validateTimeout(-Infinity)).toThrow('Timeout must be a non-negative number');
    expect(() => validateTimeout(NaN)).toThrow('Timeout must be a non-negative number');
  });
});
