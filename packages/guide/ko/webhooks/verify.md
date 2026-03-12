# 결제 결과 검증

Webhook 또는 Callback URL로 수신한 결제 결과를 검증하는 방법입니다.

## 검증 플로우

**Webhook**이든 **Callback URL**이든, 검증 프로세스는 동일합니다:

```
1. orderId 수신 (webhook payload 또는 callback URL 파라미터)
       ↓
2. orderId로 결제 API 조회 → 실제 결제 상태 확인
       ↓
3. API 응답과 DB의 주문 정보 비교 검증
       ↓
4. 검증 통과 시, paymentId를 주문에 연결하고 상태 업데이트
```

::: warning 반드시 API로 검증하세요
Webhook payload나 callback URL 파라미터를 그대로 신뢰하지 마세요. 반드시 서버에서 SoloPay API를 호출해 실제 결제 상태를 확인해야 합니다.
:::

## Step 1: orderId로 결제 조회

```bash
curl https://pay-api.staging.sut.com/api/v1/payments?orderId=order-001 \
  -H "x-api-key: sk_test_xxxxx"
```

## Step 2: 검증 및 연결

```typescript
async function verifyPayment(orderId: string) {
  // 1. orderId로 SoloPay API에서 결제 정보 조회
  const payment = await solopayApi.getPaymentByOrderId(orderId);

  // 2. DB에서 해당 주문 조회
  const order = await db.orders.findByOrderId(orderId);
  if (!order) throw new Error('주문을 찾을 수 없음');

  // 3. 결제 정보와 주문 정보 비교 검증
  if (payment.amount !== order.expectedAmount) throw new Error('금액 불일치');
  if (payment.tokenAddress !== order.expectedToken) throw new Error('토큰 불일치');

  // 4. 결제 상태 확인
  if (payment.status !== 'ESCROWED' && payment.status !== 'FINALIZED') {
    return; // 아직 결제 완료 아님
  }

  // 5. paymentId를 주문에 연결하고 상태 업데이트
  await db.orders.update(orderId, {
    paymentId: payment.paymentId,
    status: 'PAID',
    paidAt: new Date(),
  });
}
```

**검증 체크리스트**

- [ ] `orderId`로 결제 API 조회 — payload/URL 값을 그대로 쓰지 말 것
- [ ] `status === 'ESCROWED'` 또는 `status === 'FINALIZED'` 확인
- [ ] `amount`, `tokenAddress`가 주문 정보와 일치 확인
- [ ] `paymentId`를 주문에 연결
- [ ] 동일 `paymentId`의 중복 처리 방지

## 멱등성 처리

같은 이벤트가 여러 번 전송될 수 있습니다. `paymentId`를 기준으로 중복 처리를 방지하세요.

```typescript
const alreadyProcessed = await db.orders.isPaymentProcessed(data.paymentId);
if (alreadyProcessed) {
  return res.status(200).json({ received: true });
}
```

## Callback URL vs Webhook

두 방식 모두 동일한 검증 플로우를 실행합니다. 차이점은 안정성입니다:

| | Callback URL | Webhook |
|---|---|---|
| **트리거** | 브라우저가 `successUrl`/`failUrl`로 리다이렉트 | 서버간 HTTP POST |
| **안정성** | 사용자가 브라우저를 닫으면 실패 가능 | 재시도 메커니즘으로 안정적 |
| **용도** | 즉시 UI 피드백 + 검증 | 백그라운드 주문 처리 + 검증 |

::: tip
최대 안정성을 위해 **callback 핸들러와 webhook 핸들러 모두**에 동일한 검증 플로우를 구현하세요. 먼저 도착하는 쪽이 처리하고, 나머지는 멱등성 처리로 무시됩니다.
:::

## 다음 단계

- [이벤트 상세](/ko/webhooks/events) - 이벤트별 처리 방법
- [API Reference](/ko/api/) - 전체 API 명세
