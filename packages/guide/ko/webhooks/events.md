# 이벤트 상세

각 Webhook 이벤트의 상세 정보입니다.

## payment.paid

온체인 결제가 확인된 상태입니다. 사용자가 결제를 완료했고 자금이 상점으로 직접 전송되었습니다.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "PAID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:42.000Z"
}
```

## payment.invalid

온체인에서 결제 트랜잭션이 감지되었으나, 검증에 실패한 상태입니다. 금액, 토큰, 수신자 주소 등이 기대 값과 일치하지 않을 때 발생합니다.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "INVALID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:42.000Z"
}
```

## Payload 필드

| 필드          | 타입     | 설명                                            |
| ------------- | -------- | ----------------------------------------------- |
| `paymentId`   | `string` | 결제 고유 식별자 (bytes32 해시)                 |
| `orderId`     | `string` | 가맹점 주문 ID (미제공 시 null)                 |
| `status`      | `string` | 이벤트 시점의 결제 상태 (`PAID` 또는 `INVALID`) |
| `txHash`      | `string` | 결제 트랜잭션 해시                              |
| `amount`      | `string` | wei 단위 금액 (정밀도 유지를 위해 문자열)       |
| `tokenSymbol` | `string` | 토큰 심볼 (예: USDC, SUT)                       |
| `paidAt`      | `string` | ISO-8601 타임스탬프                             |

## 이벤트 핸들러 예시

```typescript
async function handleWebhook(payload: any) {
  const { status, orderId, paymentId } = payload;

  switch (status) {
    case 'PAID':
      await completeOrder(orderId);
      break;
    case 'INVALID':
      await flagOrderForReview(orderId);
      break;
  }
}
```

## 다음 단계

- [결제 상태](/ko/payments/status) - 전체 상태 값
- [환불](/ko/payments/refunds) - 결제 환불 처리
- [API Reference](/ko/api/) - 전체 API 명세
- [에러 코드](/ko/api/errors) - 에러 처리
