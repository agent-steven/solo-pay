# 결제 내역 조회

가맹점의 결제 내역을 조회합니다. API Key 인증이 필요합니다.

## REST API

```bash
# orderId로 조회
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments?orderId=order-001" \
  -H "x-api-key: sk_xxxxx"

# paymentId로 조회
curl "https://gateway.dev.solonetwork.io/api/v1/merchant/payments/0xabc123..." \
  -H "x-api-key: sk_xxxxx"
```

## 응답

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

## 응답 필드

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

## 다음 단계

- [에러 코드](/ko/api/errors) - 에러 처리
