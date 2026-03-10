# 이벤트 상세

각 Webhook 이벤트의 상세 정보입니다.

## ESCROWED

결제가 에스크로된 상태입니다. 사용자가 결제를 완료했고 자금이 에스크로에 보관됩니다. 상점은 확정(자금 해제) 또는 취소(구매자 환불)를 선택할 수 있습니다.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "ESCROWED",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "escrowedAt": "2024-01-26T12:35:00.000Z"
}
```

## FINALIZED

자금이 상점으로 해제되었습니다. 확정 플로우의 최종 성공 상태입니다.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "FINALIZED",
  "txHash": "0xdef789...",
  "releaseTxHash": "0xrelease123...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "finalizedAt": "2024-01-26T12:36:00.000Z"
}
```

## CANCELLED

에스크로 결제가 취소되어 자금이 구매자에게 환불되었습니다.

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "CANCELLED",
  "txHash": "0xdef789...",
  "releaseTxHash": "0xcancel123...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "cancelledAt": "2024-01-26T12:36:00.000Z"
}
```

## Payload 필드

| 필드            | 타입     | 설명                                                        |
| --------------- | -------- | ----------------------------------------------------------- |
| `paymentId`     | `string` | 결제 고유 식별자 (bytes32 해시)                             |
| `orderId`       | `string` | 가맹점 주문 ID (미제공 시 null)                             |
| `status`        | `string` | 이벤트 시점의 결제 상태                                     |
| `txHash`        | `string` | 에스크로(결제) 트랜잭션 해시                                |
| `releaseTxHash` | `string` | 확정 또는 취소 트랜잭션 해시 (finalized/cancelled 이벤트만) |
| `amount`        | `string` | wei 단위 금액 (정밀도 유지를 위해 문자열)                   |
| `tokenSymbol`   | `string` | 토큰 심볼 (예: USDC, SUT)                                   |
| `escrowedAt`    | `string` | ISO-8601 타임스탬프 (escrowed 이벤트만)                     |
| `finalizedAt`   | `string` | ISO-8601 타임스탬프 (finalized 이벤트만)                    |
| `cancelledAt`   | `string` | ISO-8601 타임스탬프 (cancelled 이벤트만)                    |

## 이벤트 핸들러 예시

```typescript
async function handleWebhook(payload: any) {
  const { status, orderId, paymentId } = payload;

  switch (status) {
    case 'ESCROWED':
      await updateOrderStatus(orderId, 'PAID_ESCROW');
      // 여기서 주문 완료 처리하거나 FINALIZED 대기
      break;
    case 'FINALIZED':
      await completeOrder(orderId);
      break;
    case 'CANCELLED':
      await cancelOrder(orderId);
      break;
  }
}
```

## 다음 단계

- [결제 상태](/ko/payments/status) - 전체 상태 값
- [결제 확정 및 취소](/ko/payments/finalize) - 에스크로 후 확정/취소
- [API Reference](/ko/api/) - 전체 API 명세
- [에러 코드](/ko/api/errors) - 에러 처리
