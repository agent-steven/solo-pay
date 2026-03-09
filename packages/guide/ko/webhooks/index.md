# Webhook

결제 상태 변경 시 실시간으로 알림을 받습니다.

## Webhook 개요

Webhook을 설정하면 결제 상태가 변경될 때 지정한 URL로 HTTP POST 요청을 받을 수 있습니다.

::: tip 왜 Webhook을 사용해야 하나요?

- **실시간 알림**: 상태 변경 즉시 알림
- **서버 리소스 절약**: 폴링 불필요
- **신뢰성**: 재시도 메커니즘 내장
  :::

## 이벤트 타입

| 이벤트              | 설명            | 발생 시점                  |
| ------------------- | --------------- | -------------------------- |
| `payment.created`   | 결제 생성됨     | 결제 생성 직후             |
| `payment.escrowed`  | 결제 에스크로됨 | 사용자 결제 완료, 에스크로 |
| `payment.finalized` | 결제 확정됨     | 자금 상점으로 확정         |
| `payment.cancelled` | 결제 취소됨     | 자금 구매자에게 환불       |
| `payment.failed`    | 결제 실패       | TX 실패 시                 |
| `payment.expired`   | 결제 만료       | 5분 초과 시                |

**payment.escrowed** 수신 시 주문 내용을 검증하고 finalize를 호출합니다. **payment.finalized** 수신 후 주문을 완료 처리합니다.

## Payload 구조

```json
{
  "event": "payment.finalized",
  "timestamp": "2024-01-26T12:35:42Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FINALIZED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "finalizedAt": "2024-01-26T12:35:42Z"
  }
}
```

## 헤더

| 헤더           | 설명               |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

## 이벤트별 Payload 상세

### payment.created

결제가 생성되었을 때 발생합니다.

```json
{
  "event": "payment.created",
  "timestamp": "2024-01-26T12:30:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "CREATED",
    "amount": "10500000000000000000",
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "tokenSymbol": "SUT",
    "orderId": "order-001",
    "expiresAt": "2024-01-26T12:35:00Z",
    "createdAt": "2024-01-26T12:30:00Z"
  }
}
```

### payment.escrowed

결제가 에스크로된 상태입니다. 사용자가 결제를 완료했고 자금이 에스크로에 보관됩니다. 상점은 확정(자금 해제) 또는 취소(구매자 환불)를 선택할 수 있습니다.

```json
{
  "event": "payment.escrowed",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "ESCROWED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "escrowedAt": "2024-01-26T12:35:00Z"
  }
}
```

### payment.finalized

자금이 상점으로 해제되었습니다. 확정 플로우의 최종 성공 상태입니다.

```json
{
  "event": "payment.finalized",
  "timestamp": "2024-01-26T12:36:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FINALIZED",
    "amount": "10500000000000000000",
    "tokenSymbol": "SUT",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "finalizedAt": "2024-01-26T12:36:00Z"
  }
}
```

### payment.cancelled

에스크로 결제가 취소되어 자금이 구매자에게 환불되었습니다.

```json
{
  "event": "payment.cancelled",
  "timestamp": "2024-01-26T12:36:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "CANCELLED",
    "orderId": "order-001",
    "cancelledAt": "2024-01-26T12:36:00Z"
  }
}
```

### payment.failed

트랜잭션이 실패했을 때 발생합니다.

```json
{
  "event": "payment.failed",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "FAILED",
    "amount": "10500000000000000000",
    "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "orderId": "order-001",
    "failureReason": "Transaction reverted"
  }
}
```

### payment.expired

결제가 만료되었을 때 발생합니다. (5분 초과 시)

```json
{
  "event": "payment.expired",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "status": "EXPIRED",
    "orderId": "order-001",
    "expiredAt": "2024-01-26T12:35:00Z"
  }
}
```

## 이벤트 핸들러 예시

```typescript
async function handleWebhook(event: any) {
  const { event: eventType, data } = event;

  switch (eventType) {
    case 'payment.created':
      await updateOrderStatus(data.orderId, 'PENDING_PAYMENT');
      break;

    case 'payment.escrowed':
      await updateOrderStatus(data.orderId, 'PAID_ESCROW');
      // 여기서 주문 완료 처리하거나 payment.finalized 대기
      break;

    case 'payment.finalized':
      await completeOrder(data.orderId);
      await sendNotification(data.payerAddress, '결제 완료');
      break;

    case 'payment.cancelled':
      await cancelOrder(data.orderId);
      break;

    case 'payment.failed':
      await updateOrderStatus(data.orderId, 'PAYMENT_FAILED');
      break;

    case 'payment.expired':
      await cancelOrder(data.orderId);
      break;

    default:
      console.log('Unknown event:', eventType);
  }
}
```

## 결제 결과 검증

Webhook으로 수신한 이벤트의 결제 정보를 검증하는 방법입니다.

### 서버 사이드 검증

Webhook payload에 포함된 `paymentId`를 이용하여 서버에서 SoloPay API를 직접 호출해 결제 상태를 확인합니다.

::: warning 반드시 서버에서 검증하세요
Webhook payload의 내용을 그대로 신뢰하지 마세요. 반드시 API를 통해 실제 결제 상태를 재확인해야 합니다.
:::

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

### 검증 체크리스트

- [ ] `status === 'ESCROWED'` 확인 (결제 성공)
- [ ] `amount`가 주문 금액과 일치 확인
- [ ] `orderId`가 DB에 저장된 orderId와 일치 확인
- [ ] 동일 `paymentId`의 중복 처리 방지
- [ ] finalize 호출 후, `FINALIZED` 상태를 확인한 뒤 주문 완료 처리

### 멱등성 처리

같은 이벤트가 여러 번 전송될 수 있습니다. `paymentId`를 기준으로 중복 처리를 방지하세요.

```typescript
// 이미 처리된 paymentId인지 확인 (DB 조회)
const alreadyProcessed = await db.orders.isPaymentProcessed(data.paymentId);
if (alreadyProcessed) {
  return res.status(200).json({ received: true }); // 중복 이벤트 무시
}
```

## 가맹점 Webhook URL 설정

현재 가맹점 데이터 모델에 `webhook_url` 필드가 존재합니다. 관리자에게 문의하여 설정하세요.

## 다음 단계

- [결제 상태 조회](/ko/payments/status) - 폴링 방식으로 상태 확인
- [결제 확정 및 취소](/ko/payments/finalize) - 에스크로 후 확정/취소
- [API Reference](/ko/api/) - 전체 API 명세
- [에러 코드](/ko/api/errors) - 에러 처리
