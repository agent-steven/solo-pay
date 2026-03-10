# 결제 상태 조회

결제의 현재 상태를 조회합니다.

- 인증: `x-public-key` 헤더 필수
- GET 요청 시 Origin 헤더 대신 `x-origin` 헤더 사용 가능 (프록시 환경)

## REST API

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

## 응답

### 성공 (200 OK)

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

- **txHash** -- 결제 트랜잭션 해시. 사용자가 결제를 완료하여 PAID 이후 상태일 때 존재합니다.

## 상태 흐름

```
CREATED ──► PAID
CREATED ──► INVALID
CREATED ──► EXPIRED
CREATED ──► FAILED
PAID    ──► REFUND_SUBMITTED ──► REFUNDED
```

## 상태 설명

| 상태               | 설명                                            | 다음 액션               |
| ------------------ | ----------------------------------------------- | ----------------------- |
| `CREATED`          | 결제 생성됨, 온체인 트랜잭션 대기               | 사용자가 결제 진행      |
| `PAID`             | 온체인 결제 확인됨                              | 없음 (종료 - 성공)      |
| `REFUND_SUBMITTED` | 환불 요청 제출됨 (개발 중)                      | REFUNDED 될 때까지 대기 |
| `REFUNDED`         | 환불 완료됨 (개발 중)                           | 없음 (종료)             |
| `INVALID`          | 온체인 결제 검증 실패 (금액/토큰/수신자 불일치) | 새 결제 생성            |
| `EXPIRED`          | 만료 (5분 초과)                                 | 새 결제 생성            |
| `FAILED`           | 트랜잭션 실패                                   | 새 결제 생성            |

::: tip 온체인 동기화
GET /payments/:id 호출 시 블록체인과 DB 상태를 실시간으로 동기화합니다. 결제 성공 시 상태는 **PAID**(온체인 결제 확인, 자금이 상점으로 직접 전송됨)가 됩니다.
:::

## 다음 단계

- [환불](/ko/payments/refunds) - 결제 환불 처리
- [결제 동작 원리](/ko/developer/how-it-works) - 가스리스 아키텍처
- [에러 코드](/ko/api/errors) - 에러 처리
