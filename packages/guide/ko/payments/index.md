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
       │  { paymentId, serverSignature, ... }          │
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
    "serverSignature": "0x...",
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
    "escrowDuration": "300",
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

| 필드                   | 타입       | 설명                                                                                 |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `paymentId`            | `string`   | 결제 고유 식별자 (bytes32 해시)                                                      |
| `serverSignature`      | `string`   | 서버 EIP-712 서명 (컨트랙트 인증용)                                                  |
| `amount`               | `string`   | wei 단위로 변환된 금액                                                               |
| `gatewayAddress`       | `address`  | PaymentGateway 컨트랙트 주소                                                         |
| `forwarderAddress`     | `address`  | ERC2771 Forwarder 주소 (Gasless용)                                                   |
| `merchantId`           | `string`   | bytes32 형태의 가맹점 ID                                                             |
| `deadline`             | `string`   | 서버 서명 만료 기한 (Unix timestamp); `pay()` 및 가스리스에 필요. 기본 1시간(3600초) |
| `escrowDuration`       | `string`   | 에스크로 유지 기간(초); `pay()` 및 가스리스에 필요. 기본 5분(300초)                  |
| `expiresAt`            | `datetime` | 결제 만료 시각 (생성 후 5분)                                                         |
| `tokenPermitSupported` | `boolean`  | EIP-2612 Permit 지원 여부                                                            |
| `currency`             | `string`   | 법정화폐 통화 코드 (요청 시에만 포함)                                                |
| `fiatAmount`           | `number`   | 원래 법정화폐 금액 (요청 시에만 포함)                                                |
| `tokenPrice`           | `number`   | 결제 생성 시점 토큰 가격 (요청 시에만 포함)                                          |

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
    "status": "ESCROWED",
    "chainId": 80002,
    "serverSignature": "0x...",
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
    "escrowDuration": "300",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail",
    "expiresAt": "2024-01-26T12:35:00.000Z",
    "txHash": "0xdef789...",
    "releaseTxHash": null,
    "payerAddress": "0x...",
    "createdAt": "2024-01-26T12:30:00Z",
    "currency": "USD",
    "fiatAmount": 10.5,
    "tokenPrice": 1.0
  }
}
```

- **txHash** — 에스크로(결제) 트랜잭션 해시. 사용자가 결제를 완료하여 ESCROWED 이후 상태일 때 존재합니다.
- **releaseTxHash** — 확정 또는 취소 트랜잭션 해시. 상태가 FINALIZE_SUBMITTED, FINALIZED, CANCEL_SUBMITTED, CANCELLED일 때 존재합니다.
- **serverSignature** — 비종료 상태에 대한 새로운 EIP-712 서버 서명. 종료 상태(FINALIZED, CANCELLED, EXPIRED, FAILED)에서는 비어 있습니다.
- **escrowDuration** — 에스크로 유지 시간(초). 결제가 에스크로된 후 이 기간이 경과하기 전에 상점이 확정(finalize)을 호출해야 합니다.

### 상태 흐름

```
CREATED ──► ESCROWED ──► FINALIZE_SUBMITTED ──► FINALIZED
                    └──► CANCEL_SUBMITTED   ──► CANCELLED
CREATED ──► EXPIRED
CREATED ──► FAILED
```

### 상태 설명

| 상태                 | 설명                              | 다음 액션                                                           |
| -------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `CREATED`            | 결제 생성됨, 온체인 트랜잭션 대기 | 사용자가 결제 진행                                                  |
| `ESCROWED`           | 결제 에스크로됨 (온체인)          | 상점: [결제 확정 및 취소](#결제-확정-및-취소) 호출로 자금 해제/환불 |
| `FINALIZE_SUBMITTED` | 확정 트랜잭션 제출됨              | FINALIZED 될 때까지 대기                                            |
| `FINALIZED`          | 자금이 상점으로 해제됨            | 없음 (종료)                                                         |
| `CANCEL_SUBMITTED`   | 취소 트랜잭션 제출됨              | CANCELLED 될 때까지 대기                                            |
| `CANCELLED`          | 자금이 구매자에게 환불됨          | 없음 (종료)                                                         |
| `FAILED`             | 트랜잭션 실패                     | 새 결제 생성                                                        |
| `EXPIRED`            | 만료 (5분 초과)                   | 새 결제 생성                                                        |

::: tip 온체인 동기화
GET /payments/:id 호출 시 블록체인과 DB 상태를 실시간으로 동기화합니다. 결제 성공 시 상태는 **ESCROWED**(사용자 결제 완료, finalize 호출 필요)이며, finalize 후 **FINALIZED**(자금 상점 확정)가 됩니다.
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
    "status": "FINALIZED",
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

| 필드            | 타입     | 설명                                                                                           |
| --------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `paymentId`     | `string` | 결제 고유 식별자 (bytes32 해시)                                                                |
| `orderId`       | `string` | 가맹점 주문 ID                                                                                 |
| `status`        | `string` | CREATED, ESCROWED, FINALIZE_SUBMITTED, FINALIZED, CANCEL_SUBMITTED, CANCELLED, EXPIRED, FAILED |
| `amount`        | `string` | wei 단위 금액                                                                                  |
| `tokenSymbol`   | `string` | 토큰 심볼                                                                                      |
| `tokenDecimals` | `number` | 토큰 소수점                                                                                    |
| `txHash`        | `string` | 온체인 트랜잭션 해시 (확정 후 존재)                                                            |
| `payerAddress`  | `string` | 결제자 지갑 주소 (확정 후 존재)                                                                |
| `confirmedAt`   | `string` | 결제 확정 시각                                                                                 |
| `expiresAt`     | `string` | 결제 만료 시각                                                                                 |

---

## 결제 확정 및 취소

결제가 **ESCROWED** 상태가 되면, 상점은 **확정(finalize)**(상점 지갑으로 자금 해제) 또는 **취소(cancel)**(구매자에게 환불) 중 하나를 선택해야 합니다. 두 작업 모두 **상점 서버**에서 API 키로 호출합니다.

### 호출 가능 주체

- **POST /payments/:id/finalize** — 해당 결제의 **상점만** 호출 가능 (`x-api-key` 인증). **에스크로 기한** 내에 호출해야 하며, 기한이 지나면 API가 `ESCROW_EXPIRED`를 반환합니다.
- **POST /payments/:id/cancel** — 해당 결제의 **상점만** 호출 가능 (`x-api-key` 인증). 결제가 ESCROWED인 동안 유효합니다. **에스크로 기한**이 지나면, 이 API 없이도 **온체인에서** 누구나 취소(컨트랙트 직접 호출)할 수 있으며, 이 API는 상점이 기한 전 또는 기한 내에 취소할 때 사용합니다.

### 만료 vs 에스크로 기한

- **결제 EXPIRED** — 결제 생성 후 지정된 시간(예: 5분 초과) 안에 결제가 완료되지 않은 경우. 상태가 `EXPIRED`가 되며 에스크로는 발생하지 않습니다. 새 결제를 생성해 재시도하세요.
- **에스크로 기한** — 결제가 ESCROWED가 된 뒤, 상점은 에스크로 기한까지 **확정(finalize)**(자금 해제)할 수 있습니다. 기한이 지나면 이 API로 finalize를 호출하면 `ESCROW_EXPIRED`가 반환되고, 컨트랙트에서는 **권한 없이 취소**(permissionless cancel)가 가능할 수 있어, 누구나 온체인에서 cancel을 호출할 수 있는 상태가 됩니다. 호출 시 자금이 구매자에게 환불됩니다.

### 호출 시점

- **ESCROWED** 웹훅을 받은 후, 또는
- **GET /payments/:id** 응답에서 `status: "ESCROWED"`인 경우

이후 **POST /payments/:id/finalize**로 자금을 본인 지갑으로 해제하거나, **POST /payments/:id/cancel**로 구매자에게 환불합니다.

### 확정 (Finalize, 상점으로 자금 해제)

**엔드포인트:** `POST /payments/:id/finalize`
**인증:** `x-api-key` (API 키만 사용, public key 아님)

요청 본문 없음. 결제 ID는 URL 경로에 포함됩니다.

#### 예시

```bash
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../finalize \
  -H "x-api-key: sk_xxxxx"
```

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "relayRequestId": "uuid-...",
    "transactionHash": null,
    "status": "submitted"
  }
}
```

응답의 `data.status`는 **릴레이 제출 상태**(`submitted` 또는 `pending`)이며 결제 상태가 아닙니다. 결제 상태는 DB에서 **FINALIZE_SUBMITTED**가 되고, 온체인 트랜잭션 확정 후 **FINALIZED**가 되며 **FINALIZED** 웹훅이 전달됩니다. **GET /payments/:id**로 폴링하여 `status === "FINALIZED"`가 될 때까지 확인하세요.

::: tip 에스크로 기한 (기본 5분)
확정(finalize)은 에스크로 기한(기본 300초 = 5분) 내에 호출해야 합니다. 이 기한은 온체인 에스크로 시점(`pay()` 트랜잭션 확정)부터 카운트됩니다. 기한이 지나면 API는 `ESCROW_EXPIRED`를 반환하고, 컨트랙트에서는 누구나 온체인에서 취소(권한 없이)할 수 있습니다.
:::

### 취소 (Cancel, 구매자에게 환불)

**엔드포인트:** `POST /payments/:id/cancel`
**인증:** `x-api-key` (상점만; 해당 결제 소유 상점)

요청 본문 없음. finalize와 동일한 패턴입니다. 에스크로 기한이 지나면 이 API 없이도 누구나 온체인에서 취소할 수 있습니다.

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "relayRequestId": "uuid-...",
    "transactionHash": null,
    "status": "submitted"
  }
}
```

finalize와 마찬가지로 `data.status`는 릴레이 제출 상태입니다. 결제 상태는 **CANCEL_SUBMITTED**가 된 뒤 온체인 확정 시 **CANCELLED**가 되며 **CANCELLED** 웹훅이 전달됩니다.

### 에러 코드

| HTTP | Code                                                                     | 의미                                    |
| ---- | ------------------------------------------------------------------------ | --------------------------------------- |
| 400  | INVALID_STATUS                                                           | 결제가 ESCROWED가 아님                  |
| 400  | ESCROW_EXPIRED                                                           | 에스크로 기한 경과 (finalize만 해당)    |
| 403  | FORBIDDEN                                                                | 해당 결제가 이 상점 소유가 아님         |
| 404  | PAYMENT_NOT_FOUND                                                        | 결제를 찾을 수 없음                     |
| 409  | CONFLICT                                                                 | 동시 finalize/cancel 요청 (이미 제출됨) |
| 500  | CHAIN_CONFIG_ERROR, SIGNING_SERVICE_ERROR, RELAYER_ERROR, INTERNAL_ERROR | 서버 또는 체인 오류                     |

자세한 내용은 [에러 코드](/ko/api/errors)를 참조하세요.
