# 결제

SoloPay 결제의 전체 API를 설명합니다.

## 결제 생성

결제를 생성하고 고유 ID를 발급받습니다.

### 개요

SoloPay 위젯을 사용하면 **결제 생성은 위젯이 자동으로 처리**합니다. 이 페이지는 내부 동작을 이해하거나 커스텀 구현을 위한 참고용 API 명세입니다.

생성된 결제는 **5분 후 자동 만료**됩니다.

- 인증: `x-public-key` 헤더 필수 (pk_xxx)
- 체인 및 수령 주소는 가맹점 설정에서 자동 결정
- `tokenAddress`는 화이트리스트 등록 및 가맹점 활성화가 필수

### 결제 플로우

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  SoloPay 위젯│         │  SoloPay API │         │   블록체인   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  POST /payments       │                       │
       │──────────────────────▶│                       │
       │                       │                       │
       │  { paymentId, deadline, ... }                  │
       │◀──────────────────────│                       │
       │                       │                       │
       │     (사용자가 지갑에서 결제)                   │
       │                       │                       │
       │                       │    TX 전송            │
       │                       │──────────────────────▶│
```

### REST API

```bash
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments \
  -H "x-public-key: pk_xxxxx" \
  -H "Origin: https://yourshop.com" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-001",
    "amount": 10.5,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail"
  }'
```

### 요청 파라미터

| 필드           | 타입      | 필수 | 설명                                                             |
| -------------- | --------- | ---- | ---------------------------------------------------------------- |
| `orderId`      | `string`  | ✓    | 가맹점 주문 식별자 (같은 가맹점 내 중복 불가)                    |
| `amount`       | `number`  | ✓    | 결제 금액 (토큰 단위 또는 법정화폐 단위). 소수점 이하 최대 2자리 |
| `tokenAddress` | `address` | ✓    | ERC-20 토큰 컨트랙트 주소 (화이트리스트 & 가맹점 활성화 필수)    |
| `successUrl`   | `string`  | ✓    | 결제 성공 시 리다이렉트 URL                                      |
| `failUrl`      | `string`  | ✓    | 결제 실패 시 리다이렉트 URL                                      |
| `currency`     | `string`  |      | 법정화폐 코드 (예: `USD`, `KRW`). 입력 시 가격 변환 적용         |

::: tip currency 옵션
`currency`를 입력하면 `amount`는 법정화폐 기준으로 해석됩니다. 서버가 토큰 가격을 조회하여 토큰 단위로 변환합니다.
예: `amount: 10, currency: "USD"` → USD 10에 해당하는 토큰 수량으로 결제
:::

::: warning amount 소수점 제한
`amount`는 소수점 이하 최대 **2자리**까지만 허용됩니다 (예: `10.50` ✓, `10.123` ✗). `currency` 없이 전달하면 토큰 수량으로 직접 사용되며, `currency`가 있으면 법정화폐 금액에서 토큰 수량으로 변환 후 소수 둘째자리로 절삭됩니다. 최소 토큰 수량은 `0.01`입니다.
:::

### 응답

#### 성공 (201 Created)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123def456...",
    "orderId": "order-001",
    "chainId": 80002,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "gatewayAddress": "0x...",
    "forwarderAddress": "0x...",
    "amount": "10500000000000000000",
    "recipientAddress": "0xMerchantWallet...",
    "merchantId": "0x...",
    "deadline": "1706281200",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "tokenPermitSupported": true,
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

#### 에러 응답

| HTTP | 코드                           | 원인                              |
| ---- | ------------------------------ | --------------------------------- |
| 400  | `TOKEN_NOT_ENABLED`            | 해당 토큰이 가맹점에서 비활성화됨 |
| 404  | `TOKEN_NOT_FOUND`              | 화이트리스트에 없는 토큰          |
| 400  | `UNSUPPORTED_CHAIN`            | 지원하지 않는 체인                |
| 400  | `CHAIN_NOT_CONFIGURED`         | 가맹점에 체인이 설정되지 않음     |
| 400  | `RECIPIENT_NOT_CONFIGURED`     | 가맹점 수령 주소 미설정           |
| 400  | `CHAIN_MISMATCH`               | 토큰이 가맹점 체인에 속하지 않음  |
| 400  | `UNSUPPORTED_TOKEN`            | 해당 체인에서 지원되지 않는 토큰  |
| 400  | `PRICE_SERVICE_NOT_CONFIGURED` | 통화 변환 서비스 사용 불가        |
| 400  | `VALIDATION_ERROR`             | 입력값 검증 실패                  |
| 409  | `DUPLICATE_ORDER`              | 이미 사용된 orderId               |

### 응답 필드 설명

| 필드                   | 타입       | 설명                                                                               |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `paymentId`            | `string`   | 결제 고유 식별자 (bytes32 해시)                                                    |
| `amount`               | `string`   | wei 단위로 변환된 금액                                                             |
| `gatewayAddress`       | `address`  | PaymentGateway 컨트랙트 주소                                                       |
| `forwarderAddress`     | `address`  | ERC2771 Forwarder 주소 (Gasless용)                                                 |
| `merchantId`           | `string`   | bytes32 형태의 가맹점 ID                                                           |
| `deadline`             | `string`   | 결제 기한 (Unix timestamp); 이 시각 전에 pay()를 호출해야 합니다. 기본: 5분(300초) |
| `expiresAt`            | `datetime` | 결제 만료 시각 (생성 후 5분)                                                       |
| `tokenPermitSupported` | `boolean`  | EIP-2612 Permit 지원 여부                                                          |
| `currency`             | `string`   | 법정화폐 통화 코드 (요청 시에만 포함)                                              |
| `fiatAmount`           | `number`   | 원래 법정화폐 금액 (요청 시에만 포함)                                              |
| `tokenPrice`           | `number`   | 결제 생성 시점 토큰 가격 (요청 시에만 포함)                                        |

### 위젯 사용 시

위젯(`@solo-pay/widget-js` / `@solo-pay/widget-react`)을 사용하면 이 API를 직접 호출할 필요 없이 위젯이 자동으로 처리합니다.

[클라이언트 사이드 연동 가이드](/ko/developer/client-side) 참고

---

## 결제 상태 조회

결제의 현재 상태를 조회합니다.

- 인증: `x-public-key` 헤더 필수
- GET 요청 시 Origin 헤더 대신 `x-origin` 헤더 사용 가능 (프록시 환경)

### REST API

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

### 응답

#### 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "orderId": "order-001",
    "status": "PAID",
    "chainId": 80002,
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "tokenPermitSupported": true,
    "gatewayAddress": "0x...",
    "forwarderAddress": "0x...",
    "amount": "10500000000000000000",
    "recipientAddress": "0xMerchantWallet...",
    "merchantId": "0x...",
    "deadline": "1706281200",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "txHash": "0xdef789...",
    "payerAddress": "0x...",
    "createdAt": "2024-01-26T12:30:00Z",
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

- **txHash** — 결제 트랜잭션 해시. PAID 이후 상태에서 존재합니다.

### 상태 흐름

```
CREATED ──► PAID ──► REFUND_SUBMITTED ──► REFUNDED
CREATED ──► EXPIRED
CREATED ──► FAILED
CREATED ──► INVALID
```

### 상태 설명

| 상태               | 설명                              | 다음 액션                 |
| ------------------ | --------------------------------- | ------------------------- |
| `CREATED`          | 결제 생성됨, 온체인 트랜잭션 대기 | 사용자가 결제 진행        |
| `PAID`             | 결제가 온체인에서 확인됨          | 없음 (정상 플로우의 종료) |
| `REFUND_SUBMITTED` | 환불 트랜잭션 제출됨              | REFUNDED 대기             |
| `REFUNDED`         | 환불 완료, 자금 구매자에게 반환   | 없음 (종료)               |
| `INVALID`          | 결제 검증 실패                    | 새 결제 생성              |
| `FAILED`           | 트랜잭션 실패                     | 새 결제 생성              |
| `EXPIRED`          | 만료 (5분 초과)                   | 새 결제 생성              |

::: tip 온체인 동기화
GET /payments/:id 호출 시 블록체인과 DB 상태를 실시간으로 동기화합니다. 결제 성공 시 상태는 **PAID**(온체인 결제 확인, 자금이 가맹점으로 직접 전송)입니다.
:::

---

## 결제 내역

가맹점의 결제 내역을 조회합니다. API Key 인증이 필요합니다.

### REST API

```bash
# orderId로 조회
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments?orderId=order-001" \
  -H "x-api-key: sk_xxxxx"

# paymentId로 조회
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments/0xabc123..." \
  -H "x-api-key: sk_xxxxx"
```

### 응답

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "orderId": "order-001",
    "status": "PAID",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "txHash": "0xdef789...",
    "payerAddress": "0x1234...",
    "createdAt": "2024-01-26T12:30:00Z",
    "confirmedAt": "2024-01-26T12:35:42Z",
    "expiresAt": "2024-01-26T12:35:00Z"
  }
}
```

### 응답 필드

| 필드            | 타입     | 설명                                                                |
| --------------- | -------- | ------------------------------------------------------------------- |
| `paymentId`     | `string` | 결제 고유 식별자 (bytes32 해시)                                     |
| `orderId`       | `string` | 가맹점 주문 ID                                                      |
| `status`        | `string` | CREATED, PAID, REFUND_SUBMITTED, REFUNDED, INVALID, EXPIRED, FAILED |
| `amount`        | `string` | wei 단위 금액                                                       |
| `tokenSymbol`   | `string` | 토큰 심볼                                                           |
| `tokenDecimals` | `number` | 토큰 소수점                                                         |
| `txHash`        | `string` | 온체인 트랜잭션 해시 (확정 후 존재)                                 |
| `payerAddress`  | `string` | 결제자 지갑 주소 (확정 후 존재)                                     |
| `confirmedAt`   | `string` | 결제 확정 시각                                                      |
| `expiresAt`     | `string` | 결제 만료 시각                                                      |
