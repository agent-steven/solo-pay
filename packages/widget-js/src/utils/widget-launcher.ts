import type { PaymentRequest } from '../types';
import { isMobile } from './dom';

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 660;
const POPUP_POLL_MS = 300;

export interface WidgetLauncherConfig {
  publicKey: string;
  widgetUrl: string;
  debug?: boolean;
}

/** Widget launcher for opening payment widget */
export class WidgetLauncher {
  private publicKey: string;
  private widgetUrl: string;
  private debug: boolean;
  private onClose?: () => void;
  private popupWindow: Window | null = null;
  private popupCheckInterval: ReturnType<typeof setInterval> | null = null;
  private pendingFailUrl: string | null = null;

  constructor(config: WidgetLauncherConfig) {
    this.publicKey = config.publicKey;
    this.widgetUrl = config.widgetUrl.replace(/\/+$/, '');
    this.debug = config.debug ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[SoloPay]', ...args);
    }
  }

  /** Build widget URL with payment parameters. */
  buildWidgetUrl(request: PaymentRequest): string {
    const params = new URLSearchParams({
      pk: this.publicKey,
      orderId: request.orderId,
      amount: String(request.amount),
      tokenAddress: request.tokenAddress,
      successUrl: request.successUrl,
      failUrl: request.failUrl,
    });
    if (request.currency) {
      params.set('currency', request.currency);
    }
    if (request.locale === 'ko' || request.locale === 'en') {
      params.set('lang', request.locale);
    }

    const url = `${this.widgetUrl}?${params.toString()}`;
    this.log('Built widget URL:', url);
    return url;
  }

  /**
   * Open widget. On desktop opens a popup; on mobile redirects.
   * Call directly from a user gesture (e.g. click handler) so the browser allows the popup.
   */
  open(request: PaymentRequest, options?: { onClose?: () => void }): void {
    const url = this.buildWidgetUrl(request);
    const mobile = isMobile();

    this.log('Opening widget:', mobile ? 'redirect' : 'popup');
    this.onClose = options?.onClose;

    if (mobile) {
      this.openRedirect(url);
    } else {
      this.openPopup(url, request);
    }
  }

  private openRedirect(url: string): void {
    this.log('Redirecting to widget:', url);
    window.location.href = url;
  }

  /**
   * Open widget in a popup window.
   * Uses a unique window name and explicit size/position so the browser opens a window rather than a tab.
   */
  private openPopup(url: string, request: PaymentRequest): void {
    this.log('Opening popup:', url);
    this.closePopup();
    // Build fallback failUrl for when popup is closed without postMessage
    // (e.g. browser X button). Use status=closed (not fail) because the
    // payment may have been paid on-chain before the user closed.
    // Merchant should check actual payment status via gateway API.
    try {
      const u = new URL(request.failUrl);
      u.searchParams.set('orderId', request.orderId);
      u.searchParams.set('status', 'closed');
      this.pendingFailUrl = u.toString();
    } catch {
      this.pendingFailUrl = request.failUrl;
    }

    const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
    const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

    const windowName = `solopay-widget-${Date.now()}`;
    this.popupWindow = window.open(url, windowName, features);
    if (!this.popupWindow) {
      this.pendingFailUrl = null;
      this.log('Popup blocked; falling back to redirect');
      this.openRedirect(url);
      return;
    }
    this.popupWindow.focus();

    const widgetOrigin = new URL(this.widgetUrl).origin;
    const popupRef = this.popupWindow;
    let handled = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== popupRef) return;
      if (event.origin !== widgetOrigin) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Widget sends paymentId as soon as payment is created/fetched.
      // Append it to pendingFailUrl so fallback close includes it.
      if (data.type === 'payment_init' && typeof data.paymentId === 'string') {
        this.log('Payment initialized:', data.paymentId);
        if (this.pendingFailUrl) {
          try {
            const u = new URL(this.pendingFailUrl);
            u.searchParams.set('paymentId', data.paymentId);
            this.pendingFailUrl = u.toString();
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (data.type !== 'payment_complete' && data.type !== 'wallet_connected') return;

      handled = true;
      this.log('Widget message:', data.type, data.status ?? '');
      window.removeEventListener('message', handleMessage);
      this.pendingFailUrl = null;
      if (this.popupWindow && !this.popupWindow.closed) {
        this.popupWindow.close();
      }
      this.clearPopupCheck();
      this.handleClose();

      // Redirect opener to success/fail URL so merchant page shows result
      if (data.type === 'payment_complete') {
        if (data.status === 'success' && typeof data.successUrl === 'string') {
          window.location.href = data.successUrl;
        } else if (data.status === 'fail' && typeof data.failUrl === 'string') {
          window.location.href = data.failUrl;
        }
      } else if (data.type === 'wallet_connected' && typeof data.successUrl === 'string') {
        window.location.href = data.successUrl;
      }
    };
    window.addEventListener('message', handleMessage);

    this.popupCheckInterval = setInterval(() => {
      if (this.popupWindow?.closed) {
        // Stop polling but keep popupWindow reference alive for message handler.
        if (this.popupCheckInterval !== null) {
          clearInterval(this.popupCheckInterval);
          this.popupCheckInterval = null;
        }
        // Wait briefly for any pending postMessage to arrive before fallback.
        // Widget sends postMessage before window.close(), but the event may
        // still be queued when we detect the popup is closed.
        setTimeout(() => {
          if (handled) return;
          window.removeEventListener('message', handleMessage);
          const failUrl = this.pendingFailUrl;
          this.pendingFailUrl = null;
          this.popupWindow = null;
          this.handleClose();
          if (failUrl) {
            window.location.href = failUrl;
          }
        }, 150);
      }
    }, POPUP_POLL_MS);
  }

  private clearPopupCheck(): void {
    if (this.popupCheckInterval !== null) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
    this.popupWindow = null;
  }

  private closePopup(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
    this.pendingFailUrl = null;
    this.clearPopupCheck();
  }

  /** Handle widget close */
  private handleClose(): void {
    this.log('Widget closed');
    this.onClose?.();
    this.onClose = undefined;
  }

  /** Close the popup window if open. */
  closeAll(): void {
    this.closePopup();
  }
}
