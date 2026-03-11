/**
 * Widget i18n: semantic keys (app.*, common.*, error.*, etc.).
 * Language is driven by URL param `lang` (en | ko). When user changes language in UI, URL is updated and UI re-renders.
 */

export type Locale = 'en' | 'ko';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ko'];

export const DEFAULT_LOCALE: Locale = 'en';

export type TranslationKeys = keyof typeof translations.en;

const translations = {
  en: {
    // App / layout
    'app.title': 'Solo Pay',
    'app.tagline': 'Secure Blockchain Payment',

    // Common
    'common.continue': 'Continue',
    'common.cancel': 'Cancel',
    'common.change': 'Change',
    'common.disconnect': 'Disconnect',
    'common.confirm': 'Confirm',
    'common.tryAgain': 'Try Again',
    'common.goBack': 'Go Back',
    'common.copyTxHash': 'Copy transaction hash',

    // Errors / validation
    'error.invalidParams': 'Invalid Parameters',
    'error.paymentError': 'Payment Error',
    'error.loadingPayment': 'Loading payment...',
    'error.checkingTokenSupport': 'Checking token support...',
    'error.checkingBalanceApproval': 'Checking balance & approval...',
    'error.configMissingSignature':
      'Payment configuration error: Missing server signature. Please contact support.',
    'error.configMissingRecipient':
      'Payment configuration error: Missing recipient details. Please contact support.',
    'error.gaslessNotConfigured':
      'Gasless payment is not configured for this network. Please contact support.',
    'error.transactionFailed': 'Transaction Failed',
    'error.transactionCancelled': 'Transaction was cancelled by user',
    'error.insufficientFundsGas': 'Insufficient funds for gas fee',
    'error.wrongNetwork': 'Transaction failed. Please check you are on the correct network',
    'error.transactionFailedRetry': 'Transaction failed. Please try again',
    'error.networkError': 'Network error. Please check your connection',
    'error.insufficientBalance': 'Insufficient balance. You need {amount} {token}',
    'error.paymentExpired': 'This payment has expired',

    // API error codes (mapped from gateway ErrorCodes)
    'apiError.UNAUTHORIZED': 'Authentication failed',
    'apiError.FORBIDDEN': 'Access denied',
    'apiError.VALIDATION_ERROR': 'Invalid input. Please check and try again',
    'apiError.INVALID_REQUEST': 'Invalid request',
    'apiError.PAYMENT_NOT_FOUND': 'Payment not found',
    'apiError.PAYMENT_EXPIRED': 'This payment has expired',
    'apiError.INVALID_PAYMENT_STATUS': 'Invalid payment status',
    'apiError.DUPLICATE_ORDER': 'This order has already been processed',
    'apiError.AMOUNT_MISMATCH': 'Payment amount mismatch',
    'apiError.TOKEN_NOT_FOUND': 'Token is not supported',
    'apiError.TOKEN_NOT_ENABLED': 'Token is not enabled for this merchant',
    'apiError.UNSUPPORTED_TOKEN': 'Token is not supported',
    'apiError.UNSUPPORTED_CHAIN': 'Network is not supported',
    'apiError.CHAIN_NOT_FOUND': 'Network not found',
    'apiError.CHAIN_NOT_CONFIGURED': 'Network is not configured',
    'apiError.RECIPIENT_NOT_CONFIGURED': 'Payment configuration error. Please contact support.',
    'apiError.RELAY_ALREADY_SUBMITTED': 'Payment is already being processed',
    'apiError.RELAYER_NOT_CONFIGURED': 'Gasless payment is not available. Please contact support.',
    'apiError.INVALID_SIGNATURE': 'Invalid signature. Please try again',
    'apiError.INTERNAL_ERROR': 'Server error. Please try again later',
    'apiError.NOT_FOUND': 'Resource not found',
    'apiError.CONFLICT': 'Request conflict. Please try again',
    'apiError.INVALID_CURRENCY': 'Unsupported currency',
    'apiError.INVALID_STATUS': 'Invalid payment status for this operation',
    'apiError.PAYMENT_NOT_FINALIZED': 'Payment has not been finalized',
    'apiError.ESCROW_EXPIRED': 'Payment escrow has expired',
    'apiError.PAYMENT_ALREADY_REFUNDED': 'Payment has already been refunded',
    'apiError.CHAIN_CONFIG_ERROR': 'Network configuration error. Please contact support.',
    'apiError.CHAIN_MISMATCH': 'Token does not belong to the expected network',
    'apiError.TOKEN_INFO_ERROR': 'Failed to retrieve token information',
    'apiError.MERCHANT_CHAIN_NOT_CONFIGURED':
      'Merchant network is not configured. Please contact support.',
    'apiError.PAYMENT_METHOD_EXISTS': 'Payment method already exists',
    'apiError.PRICE_SERVICE_NOT_CONFIGURED':
      'Price service is not configured. Please contact support.',
    'apiError.RELAY_NOT_FOUND': 'Relay request not found',
    'apiError.RELAYER_ERROR': 'Relay service error. Please try again',
    'apiError.SIGNATURE_ERROR': 'Signature generation failed. Please try again',
    'apiError.SIGNING_SERVICE_ERROR': 'Signing service error. Please try again later',
    'apiError.PAYER_ADDRESS_NOT_FOUND': 'Payer wallet address not found',
    'apiError.REFUND_NOT_FOUND': 'Refund not found',
    'apiError.REFUND_IN_PROGRESS': 'Refund is already being processed',
    'apiError.UNKNOWN': 'An unexpected error occurred. Please try again',

    // Connect wallet
    'connect.title': 'Connect Wallet',
    'connect.description':
      'Please connect your wallet to proceed.\nSupports MetaMask and Trust Wallet.',
    'connect.connecting': 'Connecting...',
    'connect.connectWallet': 'Connect Wallet',
    'connect.metaMask': 'MetaMask',
    'connect.trustWallet': 'Trust Wallet',

    // Wallet only
    'walletOnly.connected': 'Wallet connected',
    'walletOnly.continue': 'Continue',

    // Token approval
    'approval.title': 'Token Approval',
    'approval.description': 'Please approve token spending permission to proceed',
    'approval.connectedWallet': 'Connected Wallet',
    'approval.balance': 'Balance',
    'approval.approveToken': 'Approve Token',
    'approval.approving': 'Approving...',
    'approval.cancelPayment': 'Cancel Payment',
    'approval.gasReceived': 'Gas received',
    'approval.gasReceivedDescription':
      'Native token has been sent to your wallet. You can now approve the token below.',
    'approval.getGasInfo':
      'We provide free gas for token approval once per account. If you do not have enough gas, click the button below to receive it.',
    'approval.getGas': 'GET GAS',
    'approval.requestingGas': 'Requesting gas...',

    // Confirm payment
    'confirm.title': 'Confirm Payment',
    'confirm.reviewDetails': 'Please review your payment details',
    'confirm.paymentDetails': 'Payment Details',
    'confirm.network': 'Network',
    'confirm.payingFrom': 'Paying from',
    'confirm.gasFee': 'Gas Fee',
    'confirm.gasFree': 'Free (Covered by Solo Pay)',
    'confirm.total': 'Total',
    'confirm.payNow': 'Pay Now',
    'confirm.cancelPayment': 'Cancel Payment',

    // Processing
    'processing.title': 'Processing Payment',
    'processing.pleaseWait': 'Please wait a moment',
    'processing.paymentAmount': 'Payment Amount',
    'processing.paymentStatus': 'Payment Status',

    // Progress States
    'progress.SIGNING_PERMIT': 'Please sign token approval in wallet',
    'progress.SIGNING_FORWARD': 'Please sign payment transaction in wallet',
    'progress.RELAYING': 'Sending to payment network...',
    'progress.CONFIRMING': 'Verifying on blockchain... please wait',
    'progress.PAID': 'Payment Completed!',
    'progress.ERROR': 'Transaction failed',

    // Processing Steps List
    'step.signing': 'Sign Transaction',
    'step.relaying': 'Send to Network',
    'step.confirming': 'Verify on Blockchain',
    'step.paid': 'Payment Completed',

    // Complete
    'complete.title': 'Payment Completed',
    'complete.description': 'Your payment has been completed successfully.',
    'complete.returnToMerchant': 'Return to Merchant',
    'complete.date': 'Date',
    'complete.amount': 'Amount',
    'complete.transactionHash': 'Transaction Hash',
  },
  ko: {
    'app.title': 'Solo Pay',
    'app.tagline': '안전한 블록체인 결제',

    'common.continue': '계속',
    'common.cancel': '취소',
    'common.change': '변경',
    'common.disconnect': '연결 해제',
    'common.confirm': '확인',
    'common.tryAgain': '다시 시도',
    'common.goBack': '돌아가기',
    'common.copyTxHash': '트랜잭션 해시 복사',

    'error.invalidParams': '잘못된 매개변수',
    'error.paymentError': '결제 오류',
    'error.loadingPayment': '결제 정보 불러오는 중...',
    'error.checkingTokenSupport': '토큰 지원 확인 중...',
    'error.checkingBalanceApproval': '잔액 및 승인 확인 중...',
    'error.configMissingSignature': '결제 설정 오류: 서버 서명이 없습니다. 고객센터에 문의하세요.',
    'error.configMissingRecipient':
      '결제 설정 오류: 수신자 정보가 없습니다. 고객센터에 문의하세요.',
    'error.gaslessNotConfigured':
      '이 네트워크에서는 가스리스 결제가 설정되어 있지 않습니다. 고객센터에 문의하세요.',
    'error.transactionFailed': '트랜잭션 실패',
    'error.transactionCancelled': '사용자가 트랜잭션을 취소했습니다',
    'error.insufficientFundsGas': '가스 수수료 잔액이 부족합니다',
    'error.wrongNetwork': '트랜잭션 실패. 올바른 네트워크인지 확인하세요',
    'error.transactionFailedRetry': '트랜잭션 실패. 다시 시도해 주세요',
    'error.networkError': '네트워크 오류. 연결을 확인해 주세요',
    'error.insufficientBalance': '잔액이 부족합니다. {amount} {token} 필요',
    'error.paymentExpired': '결제가 만료되었습니다',

    // API error codes (mapped from gateway ErrorCodes)
    'apiError.UNAUTHORIZED': '인증에 실패했습니다',
    'apiError.FORBIDDEN': '접근이 거부되었습니다',
    'apiError.VALIDATION_ERROR': '입력이 올바르지 않습니다. 확인 후 다시 시도해 주세요',
    'apiError.INVALID_REQUEST': '잘못된 요청입니다',
    'apiError.PAYMENT_NOT_FOUND': '결제를 찾을 수 없습니다',
    'apiError.PAYMENT_EXPIRED': '결제가 만료되었습니다',
    'apiError.INVALID_PAYMENT_STATUS': '결제 상태가 올바르지 않습니다',
    'apiError.DUPLICATE_ORDER': '이미 처리된 주문입니다',
    'apiError.AMOUNT_MISMATCH': '결제 금액이 일치하지 않습니다',
    'apiError.TOKEN_NOT_FOUND': '지원하지 않는 토큰입니다',
    'apiError.TOKEN_NOT_ENABLED': '이 가맹점에서 활성화되지 않은 토큰입니다',
    'apiError.UNSUPPORTED_TOKEN': '지원하지 않는 토큰입니다',
    'apiError.UNSUPPORTED_CHAIN': '지원하지 않는 네트워크입니다',
    'apiError.CHAIN_NOT_FOUND': '네트워크를 찾을 수 없습니다',
    'apiError.CHAIN_NOT_CONFIGURED': '네트워크가 설정되어 있지 않습니다',
    'apiError.RECIPIENT_NOT_CONFIGURED': '결제 설정 오류입니다. 고객센터에 문의하세요.',
    'apiError.RELAY_ALREADY_SUBMITTED': '결제가 이미 처리 중입니다',
    'apiError.RELAYER_NOT_CONFIGURED': '가스리스 결제를 사용할 수 없습니다. 고객센터에 문의하세요.',
    'apiError.INVALID_SIGNATURE': '서명이 올바르지 않습니다. 다시 시도해 주세요',
    'apiError.INTERNAL_ERROR': '서버 오류입니다. 잠시 후 다시 시도해 주세요',
    'apiError.NOT_FOUND': '리소스를 찾을 수 없습니다',
    'apiError.CONFLICT': '요청 충돌이 발생했습니다. 다시 시도해 주세요',
    'apiError.INVALID_CURRENCY': '지원하지 않는 통화입니다',
    'apiError.INVALID_STATUS': '현재 상태에서 허용되지 않는 작업입니다',
    'apiError.PAYMENT_NOT_FINALIZED': '결제가 아직 완료되지 않았습니다',
    'apiError.ESCROW_EXPIRED': '결제 에스크로가 만료되었습니다',
    'apiError.PAYMENT_ALREADY_REFUNDED': '이미 환불된 결제입니다',
    'apiError.CHAIN_CONFIG_ERROR': '네트워크 설정 오류입니다. 고객센터에 문의하세요.',
    'apiError.CHAIN_MISMATCH': '토큰이 예상 네트워크에 속하지 않습니다',
    'apiError.TOKEN_INFO_ERROR': '토큰 정보를 가져올 수 없습니다',
    'apiError.MERCHANT_CHAIN_NOT_CONFIGURED':
      '가맹점 네트워크가 설정되어 있지 않습니다. 고객센터에 문의하세요.',
    'apiError.PAYMENT_METHOD_EXISTS': '결제 수단이 이미 존재합니다',
    'apiError.PRICE_SERVICE_NOT_CONFIGURED':
      '가격 서비스가 설정되어 있지 않습니다. 고객센터에 문의하세요.',
    'apiError.RELAY_NOT_FOUND': '릴레이 요청을 찾을 수 없습니다',
    'apiError.RELAYER_ERROR': '릴레이 서비스 오류입니다. 다시 시도해 주세요',
    'apiError.SIGNATURE_ERROR': '서명 생성에 실패했습니다. 다시 시도해 주세요',
    'apiError.SIGNING_SERVICE_ERROR': '서명 서비스 오류입니다. 잠시 후 다시 시도해 주세요',
    'apiError.PAYER_ADDRESS_NOT_FOUND': '결제자 지갑 주소를 찾을 수 없습니다',
    'apiError.REFUND_NOT_FOUND': '환불을 찾을 수 없습니다',
    'apiError.REFUND_IN_PROGRESS': '환불이 이미 처리 중입니다',
    'apiError.UNKNOWN': '예기치 않은 오류가 발생했습니다. 다시 시도해 주세요',

    'connect.title': '지갑 연결',
    'connect.description': '결제를 위해 지갑을 연결해 주세요.\nMetaMask, Trust Wallet 지원.',
    'connect.connecting': '연결 중...',
    'connect.connectWallet': '지갑 연결',
    'connect.metaMask': 'MetaMask',
    'connect.trustWallet': 'Trust Wallet',

    'walletOnly.connected': '지갑 연결됨',
    'walletOnly.continue': '계속',

    'approval.title': '토큰 승인',
    'approval.description': '결제를 위해 토큰 사용 권한을 승인해 주세요',
    'approval.connectedWallet': '연결된 지갑',
    'approval.balance': '잔액',
    'approval.approveToken': '토큰 승인',
    'approval.approving': '승인 중...',
    'approval.cancelPayment': '결제 취소',
    'approval.gasReceived': '가스 수령 완료',
    'approval.gasReceivedDescription':
      '네이티브 토큰이 지갑으로 전송되었습니다. 아래에서 토큰을 승인할 수 있습니다.',
    'approval.getGasInfo':
      '계정당 한 번 무료 가스를 제공합니다. 가스가 부족하면 아래 버튼을 눌러 받으세요.',
    'approval.getGas': '가스 받기',
    'approval.requestingGas': '가스 요청 중...',

    'confirm.title': '결제 확인',
    'confirm.reviewDetails': '결제 정보를 확인해 주세요',
    'confirm.paymentDetails': '결제 정보',
    'confirm.network': '네트워크',
    'confirm.payingFrom': '결제 지갑',
    'confirm.gasFee': '가스 수수료',
    'confirm.gasFree': '무료 (Solo Pay 부담)',
    'confirm.total': '총액',
    'confirm.payNow': '결제하기',
    'confirm.cancelPayment': '결제 취소',

    'processing.title': '결제 처리 중',
    'processing.pleaseWait': '잠시만 기다려 주세요',
    'processing.paymentAmount': '결제 금액',
    'processing.paymentStatus': '결제 상태',

    'progress.SIGNING_PERMIT': '지갑에서 토큰 사용을 수락해 주세요',
    'progress.SIGNING_FORWARD': '지갑에서 결제 트랜잭션을 승인해 주세요',
    'progress.RELAYING': '결제 네트워크로 전송 중...',
    'progress.CONFIRMING': '블록체인 검증 중... 잠시만 대기해 주세요',
    'progress.PAID': '결제 완료!',
    'progress.ERROR': '결제 실패',

    'step.signing': '결제 트랜잭션 서명',
    'step.relaying': '결제 네트워크 전송',
    'step.confirming': '블록체인 검증',
    'step.paid': '결제 완료',

    'complete.title': '결제 완료',
    'complete.description': '결제가 성공적으로 완료되었습니다.',
    'complete.returnToMerchant': '상점으로 돌아가기',
    'complete.date': '일시',
    'complete.amount': '금액',
    'complete.transactionHash': '트랜잭션 해시',
  },
} as const;

export function getTranslations(locale: Locale): Record<TranslationKeys, string> {
  const localeMap = locale === 'ko' ? translations.ko : translations.en;
  return localeMap as Record<TranslationKeys, string>;
}

/**
 * Translate by key; supports {param} substitution.
 */
export function t(
  locale: Locale,
  key: TranslationKeys,
  params?: Record<string, string | number>
): string {
  const dict = getTranslations(locale);
  let text = dict[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replaceAll(`{${k}}`, String(v));
    });
  }
  return text;
}

export function parseLocale(value: string | null | undefined): Locale {
  if (value === 'ko' || value === 'en') return value;
  return DEFAULT_LOCALE;
}
