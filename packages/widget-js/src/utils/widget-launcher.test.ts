import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WidgetLauncher } from './widget-launcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIDGET_URL = 'https://widget.example.com';
const PUBLIC_KEY = 'pk_test_123';
const FAIL_URL = 'https://merchant.example.com/fail';
const SUCCESS_URL = 'https://merchant.example.com/success';

/** Fallback failUrl built by widget-js (includes orderId + status from request). */
const FALLBACK_FAIL_URL = `${FAIL_URL}?orderId=order-1&status=closed`;

function makeRequest(overrides = {}) {
  return {
    orderId: 'order-1',
    amount: '10',
    tokenAddress: '0x' + 'a'.repeat(40),
    successUrl: SUCCESS_URL,
    failUrl: FAIL_URL,
    ...overrides,
  };
}

/** Minimal mock popup window. */
function createMockPopup(): Window {
  return {
    closed: false,
    close: vi.fn(function (this: { closed: boolean }) {
      this.closed = true;
    }),
    focus: vi.fn(),
  } as unknown as Window;
}

/** Dispatch a MessageEvent as if sent from the widget popup. */
function dispatchWidgetMessage(popup: Window, data: Record<string, unknown>, origin = WIDGET_URL) {
  const event = new MessageEvent('message', {
    data,
    origin: new URL(origin).origin,
    source: popup,
  });
  window.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WidgetLauncher', () => {
  let launcher: WidgetLauncher;
  let mockPopup: Window;
  const originalOpen = window.open;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPopup = createMockPopup();

    // Stub window.open to return our mock popup
    vi.stubGlobal(
      'open',
      vi.fn(() => mockPopup)
    );

    // Stub window.location.href setter
    const locationMock: Record<string, unknown> = { ...originalLocation, href: '', _href: '' };
    Object.defineProperty(locationMock, 'href', {
      get: () => (locationMock._href as string) ?? '',
      set: (v: string) => {
        locationMock._href = v;
      },
      configurable: true,
    });
    vi.stubGlobal('location', locationMock);

    launcher = new WidgetLauncher({
      publicKey: PUBLIC_KEY,
      widgetUrl: WIDGET_URL,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('open', originalOpen);
    vi.stubGlobal('location', originalLocation);
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // buildWidgetUrl
  // -----------------------------------------------------------------------
  describe('buildWidgetUrl', () => {
    it('should include all required payment parameters', () => {
      const url = launcher.buildWidgetUrl(makeRequest());
      const u = new URL(url);
      expect(u.searchParams.get('pk')).toBe(PUBLIC_KEY);
      expect(u.searchParams.get('orderId')).toBe('order-1');
      expect(u.searchParams.get('amount')).toBe('10');
      expect(u.searchParams.get('failUrl')).toBe(FAIL_URL);
      expect(u.searchParams.get('successUrl')).toBe(SUCCESS_URL);
    });

    it('should include optional currency param', () => {
      const url = launcher.buildWidgetUrl(makeRequest({ currency: 'KRW' }));
      expect(new URL(url).searchParams.get('currency')).toBe('KRW');
    });

    it('should include locale param when ko or en', () => {
      const urlKo = launcher.buildWidgetUrl(makeRequest({ locale: 'ko' }));
      expect(new URL(urlKo).searchParams.get('lang')).toBe('ko');

      const urlEn = launcher.buildWidgetUrl(makeRequest({ locale: 'en' }));
      expect(new URL(urlEn).searchParams.get('lang')).toBe('en');
    });

    it('should not include lang param for unsupported locales', () => {
      const url = launcher.buildWidgetUrl(makeRequest({ locale: 'ja' }));
      expect(new URL(url).searchParams.get('lang')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // postMessage handling (success)
  // -----------------------------------------------------------------------
  describe('postMessage handling - success', () => {
    it('should redirect to successUrl from postMessage on payment success', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const enrichedSuccessUrl = `${SUCCESS_URL}?paymentId=pay-1&orderId=order-1&status=success`;
      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'success',
        successUrl: enrichedSuccessUrl,
      });

      expect(window.location.href).toBe(enrichedSuccessUrl);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should redirect to failUrl from postMessage on payment fail', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const enrichedFailUrl = `${FAIL_URL}?paymentId=pay-1&orderId=order-1&status=fail`;
      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'fail',
        failUrl: enrichedFailUrl,
      });

      expect(window.location.href).toBe(enrichedFailUrl);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should close popup window on postMessage', () => {
      launcher.open(makeRequest());

      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'success',
        successUrl: SUCCESS_URL,
      });

      expect(mockPopup.close).toHaveBeenCalled();
    });

    it('should redirect to failUrl with status=closed from processing cancel', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const closedUrl = `${FAIL_URL}?paymentId=pay-1&orderId=order-1&status=closed`;
      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'fail',
        failUrl: closedUrl,
      });

      expect(window.location.href).toBe(closedUrl);
      expect(new URL(window.location.href).searchParams.get('status')).toBe('closed');
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should handle wallet_connected message type', () => {
      launcher.open(makeRequest());

      dispatchWidgetMessage(mockPopup, {
        type: 'wallet_connected',
        successUrl: `${SUCCESS_URL}?address=0x123`,
      });

      expect(window.location.href).toBe(`${SUCCESS_URL}?address=0x123`);
    });
  });

  // -----------------------------------------------------------------------
  // postMessage security
  // -----------------------------------------------------------------------
  describe('postMessage security', () => {
    it('should ignore messages from wrong origin', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      dispatchWidgetMessage(
        mockPopup,
        { type: 'payment_complete', status: 'success', successUrl: SUCCESS_URL },
        'https://evil.com'
      );

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should ignore messages from wrong source', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const otherWindow = createMockPopup();
      dispatchWidgetMessage(otherWindow, {
        type: 'payment_complete',
        status: 'success',
        successUrl: SUCCESS_URL,
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should ignore messages with unknown type', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      dispatchWidgetMessage(mockPopup, { type: 'unknown_type', status: 'success' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should ignore non-object messages', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const event = new MessageEvent('message', {
        data: 'just a string',
        origin: new URL(WIDGET_URL).origin,
        source: mockPopup,
      });
      window.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Popup close detection (user closes browser X)
  // -----------------------------------------------------------------------
  describe('popup close detection (browser X button)', () => {
    it('should call onClose and redirect to fallback failUrl with orderId when popup closed without message', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      // Simulate popup closed by user (no postMessage sent)
      (mockPopup as { closed: boolean }).closed = true;

      // Polling interval detects close
      vi.advanceTimersByTime(300);
      // Wait for 150ms grace period
      vi.advanceTimersByTime(150);

      expect(onClose).toHaveBeenCalledOnce();
      // Fallback includes orderId+status but not paymentId (unknown to widget-js)
      expect(window.location.href).toBe(FALLBACK_FAIL_URL);
    });

    it('should include paymentId in fallback when payment_init was received', () => {
      launcher.open(makeRequest());

      // Widget notifies paymentId after creation
      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-abc' });

      // User closes popup via browser X
      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      const redirected = new URL(window.location.href);
      expect(redirected.searchParams.get('orderId')).toBe('order-1');
      expect(redirected.searchParams.get('paymentId')).toBe('pay-abc');
      expect(redirected.searchParams.get('status')).toBe('closed');
    });

    it('should receive payment_init when popup source matches', () => {
      launcher.open(makeRequest());

      // payment_init sent from the SAME popup reference (normal case)
      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-match' });

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      expect(new URL(window.location.href).searchParams.get('paymentId')).toBe('pay-match');
    });

    it('should ignore payment_init when popup source does NOT match (different window ref)', () => {
      launcher.open(makeRequest());

      // payment_init sent from a DIFFERENT window (simulates source mismatch)
      const differentPopup = createMockPopup();
      dispatchWidgetMessage(differentPopup, { type: 'payment_init', paymentId: 'pay-wrong' });

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      // paymentId should NOT be in the URL — payment_init was ignored
      expect(new URL(window.location.href).searchParams.get('paymentId')).toBeNull();
    });

    it('should ignore payment_init from wrong origin', () => {
      launcher.open(makeRequest());

      // payment_init with correct source but wrong origin
      dispatchWidgetMessage(
        mockPopup,
        { type: 'payment_init', paymentId: 'pay-evil' },
        'https://evil.com'
      );

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      expect(new URL(window.location.href).searchParams.get('paymentId')).toBeNull();
    });

    it('should receive payment_init when widgetUrl has path (origin still matches)', () => {
      // widgetUrl with path — origin should still match
      const launcherWithPath = new WidgetLauncher({
        publicKey: PUBLIC_KEY,
        widgetUrl: WIDGET_URL + '/payment/checkout',
      });

      vi.stubGlobal(
        'open',
        vi.fn(() => mockPopup)
      );
      launcherWithPath.open(makeRequest());

      // postMessage origin = widget origin (no path)
      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-path' });

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      expect(new URL(window.location.href).searchParams.get('paymentId')).toBe('pay-path');
    });

    it('should use latest paymentId when multiple payment_init received', () => {
      launcher.open(makeRequest());

      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-first' });
      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-second' });

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      expect(new URL(window.location.href).searchParams.get('paymentId')).toBe('pay-second');
    });

    it('should receive payment_init even when popup closes immediately after', () => {
      launcher.open(makeRequest());

      // payment_init arrives, then popup closes in same tick
      dispatchWidgetMessage(mockPopup, { type: 'payment_init', paymentId: 'pay-quick' });
      (mockPopup as { closed: boolean }).closed = true;

      vi.advanceTimersByTime(300 + 150);

      expect(new URL(window.location.href).searchParams.get('paymentId')).toBe('pay-quick');
    });

    it('should not double-fire onClose', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300 + 150);

      // Advance more — should not fire again
      vi.advanceTimersByTime(1000);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // Race condition: postMessage arrives AFTER popup close detected
  // -----------------------------------------------------------------------
  describe('race condition: postMessage vs popup close', () => {
    it('should use enriched URL when postMessage arrives during grace period', () => {
      const onClose = vi.fn();
      launcher.open(makeRequest(), { onClose });

      const enrichedFailUrl = `${FAIL_URL}?paymentId=pay-1&orderId=order-1&status=fail`;

      // Popup closes (detected by polling)
      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300); // Polling detects close, starts 150ms grace period

      // During grace period, postMessage arrives
      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'fail',
        failUrl: enrichedFailUrl,
      });

      // postMessage handler fires immediately → redirects to enriched URL
      expect(window.location.href).toBe(enrichedFailUrl);
      expect(onClose).toHaveBeenCalledOnce();

      // Grace period expires — should NOT redirect again to raw failUrl
      vi.advanceTimersByTime(150);
      expect(window.location.href).toBe(enrichedFailUrl);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should fall back to failUrl with orderId when no postMessage arrives within grace period', () => {
      launcher.open(makeRequest());

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300); // Polling detects
      vi.advanceTimersByTime(150); // Grace period expires

      // Fallback includes orderId+status but not paymentId
      expect(window.location.href).toBe(FALLBACK_FAIL_URL);
    });

    it('should use enriched URL on success during race condition', () => {
      launcher.open(makeRequest());

      const enrichedSuccessUrl = `${SUCCESS_URL}?paymentId=pay-1&orderId=order-1&status=success`;

      (mockPopup as { closed: boolean }).closed = true;
      vi.advanceTimersByTime(300);

      // postMessage arrives during grace
      dispatchWidgetMessage(mockPopup, {
        type: 'payment_complete',
        status: 'success',
        successUrl: enrichedSuccessUrl,
      });

      expect(window.location.href).toBe(enrichedSuccessUrl);

      // Grace expires — no fallback
      vi.advanceTimersByTime(150);
      expect(window.location.href).toBe(enrichedSuccessUrl);
    });
  });

  // -----------------------------------------------------------------------
  // Popup blocked
  // -----------------------------------------------------------------------
  describe('popup blocked', () => {
    it('should fallback to redirect when popup is blocked', () => {
      vi.stubGlobal(
        'open',
        vi.fn(() => null)
      );

      launcher.open(makeRequest());

      // Should redirect to widget URL directly
      expect(window.location.href).toContain(WIDGET_URL);
    });
  });

  // -----------------------------------------------------------------------
  // closeAll
  // -----------------------------------------------------------------------
  describe('closeAll', () => {
    it('should close the popup window', () => {
      launcher.open(makeRequest());
      launcher.closeAll();

      expect(mockPopup.close).toHaveBeenCalled();
    });
  });
});
