import { describe, it, expect } from 'vitest';
import { validatePaymentRequest, formatAmount, truncateAddress } from './validators';

describe('validatePaymentRequest', () => {
  const validRequest = {
    orderId: 'order-1',
    amount: '10.50',
    tokenAddress: '0x' + 'a'.repeat(40),
    successUrl: 'https://example.com/success',
    failUrl: 'https://example.com/fail',
  };

  it('should pass with a valid request', () => {
    const result = validatePaymentRequest(validRequest);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should reject empty orderId', () => {
    const result = validatePaymentRequest({ ...validRequest, orderId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.orderId).toBeDefined();
  });

  it('should reject zero amount', () => {
    const result = validatePaymentRequest({ ...validRequest, amount: '0' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('should reject negative amount', () => {
    const result = validatePaymentRequest({ ...validRequest, amount: '-5' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('should reject non-numeric amount', () => {
    const result = validatePaymentRequest({ ...validRequest, amount: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('should accept numeric amount as number type', () => {
    const result = validatePaymentRequest({ ...validRequest, amount: 10 });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid token address format', () => {
    const result = validatePaymentRequest({ ...validRequest, tokenAddress: 'not-an-address' });
    expect(result.valid).toBe(false);
    expect(result.errors.tokenAddress).toBeDefined();
  });

  it('should reject token address with wrong length', () => {
    const result = validatePaymentRequest({ ...validRequest, tokenAddress: '0x123' });
    expect(result.valid).toBe(false);
    expect(result.errors.tokenAddress).toBeDefined();
  });

  it('should reject invalid successUrl', () => {
    const result = validatePaymentRequest({ ...validRequest, successUrl: 'not-a-url' });
    expect(result.valid).toBe(false);
    expect(result.errors.successUrl).toBeDefined();
  });

  it('should reject invalid failUrl', () => {
    const result = validatePaymentRequest({ ...validRequest, failUrl: 'not-a-url' });
    expect(result.valid).toBe(false);
    expect(result.errors.failUrl).toBeDefined();
  });

  it('should collect multiple errors', () => {
    const result = validatePaymentRequest({
      orderId: '',
      amount: '',
      tokenAddress: '',
      successUrl: '',
      failUrl: '',
    });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(5);
  });
});

describe('formatAmount', () => {
  it('should format a valid number', () => {
    expect(formatAmount('10.5')).toBe('10.50');
  });

  it('should use custom decimals', () => {
    expect(formatAmount('10.12345', 4)).toBe('10.1235');
  });

  it('should return 0 for NaN', () => {
    expect(formatAmount('abc')).toBe('0');
  });
});

describe('truncateAddress', () => {
  it('should truncate a long address', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateAddress(addr)).toBe('0x1234...5678');
  });

  it('should return short strings unchanged', () => {
    expect(truncateAddress('0x12')).toBe('0x12');
  });

  it('should handle empty string', () => {
    expect(truncateAddress('')).toBe('');
  });
});
