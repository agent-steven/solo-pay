# 에러 코드

API 응답에서 반환되는 에러 코드와 해결 방법입니다.

## HTTP 상태 코드

| 코드 | 설명                        |
| ---- | --------------------------- |
| 200  | 성공                        |
| 201  | 생성 성공                   |
| 202  | 요청 수락 (비동기 처리)     |
| 400  | 잘못된 요청 (파라미터 오류) |
| 401  | 인증 실패 (Key 오류)        |
| 403  | 권한 없음                   |
| 404  | 리소스 없음                 |
| 409  | 충돌 (중복 요청)            |
| 500  | 서버 오류                   |

## 에러 응답 형식

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": [...]
}
```

---

## 인증 오류 (401)

### UNAUTHORIZED

API Key 또는 Public Key가 유효하지 않거나 누락되었습니다.

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

**해결 방법**

- `x-api-key` 또는 `x-public-key` 헤더 확인
- 올바른 키 형식 사용 (sk*... 또는 pk*...)

---

## 검증 오류 (400)

### INVALID_REQUEST

일반적인 잘못된 요청 오류입니다.

```json
{ "code": "INVALID_REQUEST", "message": "Invalid request" }
```

### VALIDATION_ERROR

입력 데이터 검증에 실패했습니다.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    {
      "path": ["amount"],
      "message": "Expected number, received string"
    }
  ]
}
```

### UNSUPPORTED_CHAIN

지원하지 않는 체인입니다.

```json
{
  "code": "UNSUPPORTED_CHAIN",
  "message": "Unsupported chain"
}
```

**해결 방법**: `GET /chains` API로 지원 체인 목록 확인

### CHAIN_NOT_CONFIGURED

가맹점에 체인이 설정되지 않았습니다.

```json
{
  "code": "CHAIN_NOT_CONFIGURED",
  "message": "Merchant chain is not configured"
}
```

### CHAIN_MISMATCH

토큰이 가맹점 체인에 속하지 않습니다.

```json
{
  "code": "CHAIN_MISMATCH",
  "message": "Token does not belong to merchant chain"
}
```

### TOKEN_NOT_ENABLED

해당 토큰이 가맹점에서 비활성화되어 있습니다.

```json
{
  "code": "TOKEN_NOT_ENABLED",
  "message": "Token is not enabled for this merchant. Add and enable it in payment methods first."
}
```

**해결 방법**: `POST /merchant/payment-methods`로 토큰을 결제 수단으로 추가 후 활성화

### INVALID_PAYMENT_STATUS

이미 CREATED가 아닌 상태인 결제에 대해 가스리스(relay) 요청을 보낸 경우 반환됩니다. 가스리스는 결제 상태가 **CREATED**일 때만 가능합니다.

```json
{
  "code": "INVALID_PAYMENT_STATUS",
  "message": "결제가 이미 종료 상태입니다(PAID, REFUNDED, EXPIRED 등). Gasless 요청은 상태가 CREATED일 때만 가능합니다."
}
```

### PAYMENT_EXPIRED

결제가 만료되었습니다.

```json
{
  "code": "PAYMENT_EXPIRED",
  "message": "결제가 만료되었습니다"
}
```

### INVALID_STATUS (환불)

**POST /refunds** 호출 시 결제가 **PAID** 상태가 아닐 때 반환됩니다.

```json
{
  "code": "INVALID_STATUS",
  "message": "Payment must be PAID to request a refund. Current status: REFUNDED"
}
```

**해결 방법**: `GET /payments/:id`에서 `status === "PAID"`일 때만 환불을 요청하세요.

### INVALID_SIGNATURE

EIP-712 서명 검증에 실패했습니다.

```json
{
  "code": "INVALID_SIGNATURE",
  "message": "유효하지 않은 서명 형식입니다"
}
```

**해결 방법**

- 서명이 `0x`로 시작하는 hex 문자열인지 확인
- EIP-712 도메인 (`name: 'ERC2771Forwarder'`, `version: '1'`) 확인
- ForwardRequest 타입 구조 확인

### RELAYER_NOT_CONFIGURED

해당 체인에 Relayer가 설정되지 않았습니다.

```json
{
  "code": "RELAYER_NOT_CONFIGURED",
  "message": "No relayer configured for chain 80002"
}
```

### RECIPIENT_NOT_CONFIGURED

가맹점 수령 주소가 설정되지 않았습니다.

```json
{
  "code": "RECIPIENT_NOT_CONFIGURED",
  "message": "Merchant recipient address is not configured"
}
```

### INVALID_CURRENCY

지원하지 않는 법정화폐 코드입니다.

```json
{
  "code": "INVALID_CURRENCY",
  "message": "Unsupported currency: XYZ"
}
```

### UNSUPPORTED_TOKEN

토큰이 존재하지만 해당 체인에서 지원되지 않습니다.

```json
{ "code": "UNSUPPORTED_TOKEN", "message": "Unsupported token" }
```

### TOKEN_INFO_ERROR

블록체인에서 토큰 정보를 가져오는 데 실패했습니다.

```json
{ "code": "TOKEN_INFO_ERROR", "message": "Failed to fetch token info" }
```

### PRICE_SERVICE_NOT_CONFIGURED

통화 변환이 요청되었으나 가격 서비스가 사용 불가합니다.

```json
{ "code": "PRICE_SERVICE_NOT_CONFIGURED", "message": "Price service is not configured" }
```

### PAYER_ADDRESS_NOT_FOUND

결제자 지갑 주소를 확인할 수 없습니다.

```json
{ "code": "PAYER_ADDRESS_NOT_FOUND", "message": "Payer address not found" }
```

### RELAY_ALREADY_SUBMITTED

해당 결제에 대해 가스리스 릴레이가 이미 제출된 경우 반환됩니다.

```json
{
  "code": "RELAY_ALREADY_SUBMITTED",
  "message": "Gasless already submitted for this payment. Check relay status or use a new checkout."
}
```

### AMOUNT_MISMATCH

릴레이 요청의 금액이 데이터베이스의 결제 금액과 일치하지 않을 때 반환됩니다.

```json
{ "code": "AMOUNT_MISMATCH", "message": "Payment amount mismatch" }
```

### PAYMENT_NOT_PAID

PAID 상태가 아닌 결제에 대해 환불을 요청할 때 반환됩니다.

```json
{ "code": "PAYMENT_NOT_PAID", "message": "Payment must be PAID to request a refund" }
```

---

## 리소스 오류 (404)

### TOKEN_NOT_FOUND

화이트리스트에 없는 토큰입니다.

```json
{
  "code": "TOKEN_NOT_FOUND",
  "message": "Token not found or not whitelisted for this chain"
}
```

### PAYMENT_NOT_FOUND

결제를 찾을 수 없습니다.

```json
{
  "code": "PAYMENT_NOT_FOUND",
  "message": "결제를 찾을 수 없습니다"
}
```

### NOT_FOUND

범용 리소스 없음 오류입니다.

```json
{ "code": "NOT_FOUND", "message": "Resource not found" }
```

### CHAIN_NOT_FOUND

```json
{ "code": "CHAIN_NOT_FOUND", "message": "Chain not found" }
```

### RELAY_NOT_FOUND

해당 결제에 대한 Relay 요청이 없습니다.

```json
{
  "code": "RELAY_NOT_FOUND",
  "message": "No relay request found for this payment"
}
```

### REFUND_NOT_FOUND

환불을 찾을 수 없습니다.

```json
{ "code": "REFUND_NOT_FOUND", "message": "Refund not found" }
```

---

## 충돌 오류 (409)

### DUPLICATE_ORDER

이미 사용된 orderId입니다.

```json
{
  "code": "DUPLICATE_ORDER",
  "message": "Order ID already used for this merchant."
}
```

### PAYMENT_METHOD_EXISTS

해당 가맹점에 이미 동일한 토큰의 결제 수단이 존재합니다.

```json
{ "code": "PAYMENT_METHOD_EXISTS", "message": "Payment method already exists" }
```

### PAYMENT_ALREADY_REFUNDED

```json
{ "code": "PAYMENT_ALREADY_REFUNDED", "message": "Payment has already been refunded" }
```

### CONFLICT (환불)

**POST /refunds** 호출 시, 동일 결제에 대한 다른 환불 요청이 이미 처리 중일 때 반환됩니다.

```json
{
  "code": "CONFLICT",
  "message": "Payment is already being processed by another request"
}
```

**해결 방법**: `GET /payments/:id`로 상태가 REFUNDED가 될 때까지 대기 후 폴링하고, 환불을 즉시 재시도하지 마세요.

### REFUND_IN_PROGRESS

해당 결제에 대한 환불이 이미 진행 중일 때 반환됩니다.

```json
{ "code": "REFUND_IN_PROGRESS", "message": "A refund is already in progress for this payment" }
```

---

## 권한 오류 (403)

### FORBIDDEN

타 가맹점의 결제에 접근을 시도했습니다.

```json
{
  "code": "FORBIDDEN",
  "message": "Payment does not belong to this merchant"
}
```

---

## 서버 오류 (500)

### CHAIN_CONFIG_ERROR

체인 또는 relayer 설정이 없거나 잘못된 경우 반환됩니다.

```json
{
  "code": "CHAIN_CONFIG_ERROR",
  "message": "Chain or relayer configuration error"
}
```

### MERCHANT_CHAIN_NOT_CONFIGURED

가맹점의 체인 설정이 누락되었습니다.

```json
{ "code": "MERCHANT_CHAIN_NOT_CONFIGURED", "message": "Merchant chain is not configured" }
```

### SIGNATURE_ERROR

서버 서명 생성에 실패했습니다.

```json
{ "code": "SIGNATURE_ERROR", "message": "Signature generation failed" }
```

### SIGNING_SERVICE_ERROR

서버가 필요한 서명 생성에 실패한 경우 반환됩니다.

```json
{
  "code": "SIGNING_SERVICE_ERROR",
  "message": "Failed to generate signature"
}
```

### RELAYER_ERROR

Relayer가 트랜잭션을 블록체인에 제출하는 데 실패한 경우 반환됩니다.

```json
{
  "code": "RELAYER_ERROR",
  "message": "Relayer failed to submit transaction"
}
```

### INTERNAL_ERROR

서버 내부 오류입니다.

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal error occurred"
}
```

## 다음 단계

- [Webhook 설정](/ko/webhooks/) - 이벤트 기반 처리
