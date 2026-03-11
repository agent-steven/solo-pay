# Callback URL

결제 완료 후 브라우저 리다이렉트를 통해 결과를 전달받는 프론트엔드 방식입니다.

## 개요

사용자가 결제를 완료(또는 실패/닫기)하면, SoloPay 위젯은 결제 생성 시 지정한 `successUrl` 또는 `failUrl`로 사용자를 리다이렉트합니다. 이때 `paymentId`, `orderId`, `status`가 쿼리 파라미터로 자동 추가됩니다.

```
사용자 결제 완료
    ↓
SoloPay 위젯이 successUrl 또는 failUrl로 리다이렉트
    ↓
가맹점 페이지에서 쿼리 파라미터 수신
    ↓
서버에서 GET /merchant/payments/:id 호출하여 검증 (필수)
```

## 동작 방식

- **PC 환경**: 팝업 창에서 결제가 진행되며, 결제 완료 후 팝업이 닫히고 `successUrl` 또는 `failUrl`로 리다이렉트됩니다.
- **모바일 환경**: 전체 화면 페이지로 리다이렉트되어 결제가 진행되며, 완료 후 `successUrl` 또는 `failUrl`로 이동합니다.

## successUrl / failUrl 설정

위젯 호출 시 `successUrl`과 `failUrl`을 지정합니다.

```typescript
solopay.requestPayment({
  orderId: 'order-001',
  amount: '10.5',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  successUrl: 'https://yourshop.com/payment/success',
  failUrl: 'https://yourshop.com/payment/fail',
});
```

- `successUrl` — 결제 성공 시 리다이렉트
- `failUrl` — 결제 실패 또는 사용자가 위젯을 닫았을 때 리다이렉트

## 쿼리 파라미터

위젯이 리다이렉트 시 다음 파라미터를 자동으로 추가합니다.

| 파라미터    | 설명                                           |
| ----------- | ---------------------------------------------- |
| `paymentId` | 고유 결제 식별자                               |
| `orderId`   | 가맹점 주문 ID                                 |
| `status`    | 결제 결과: `success`, `fail`, `closed` 중 하나 |

### status 값 상세

| 값        | 리다이렉트 URL | 설명                                                                 |
| --------- | -------------- | -------------------------------------------------------------------- |
| `success` | `successUrl`   | 결제가 성공적으로 완료됨                                             |
| `fail`    | `failUrl`      | 트랜잭션 실패 등으로 결제가 실패함                                   |
| `closed`  | `failUrl`      | 사용자가 결제 완료 전에 위젯을 닫음 (결제가 생성되지 않았을 수 있음) |

### 예시 URL

```
https://yourshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=fail
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

## 프론트엔드 처리 예시

`successUrl` 또는 `failUrl` 페이지에서 쿼리 파라미터를 파싱하고, 서버 API로 결제 상태를 검증합니다.

```typescript
// successUrl 페이지 (예: /payment/success)
const params = new URLSearchParams(window.location.search);
const paymentId = params.get('paymentId');
const orderId = params.get('orderId');
const status = params.get('status');

if (paymentId) {
  // 서버에서 결제 상태 검증 (필수)
  const response = await fetch(`/api/verify-payment?paymentId=${paymentId}`);
  const result = await response.json();

  if (result.verified) {
    // 주문 완료 화면 표시
  } else {
    // 검증 실패 처리
  }
}
```

```typescript
// failUrl 페이지 (예: /payment/fail)
const params = new URLSearchParams(window.location.search);
const status = params.get('status');

if (status === 'closed') {
  // "결제가 취소되었습니다" 안내
} else {
  // "결제에 실패했습니다. 다시 시도해주세요" 안내
}
```

## 결제 결과 검증 (필수)

::: warning URL 파라미터를 신뢰하지 마세요
쿼리 파라미터는 사용자가 조작할 수 있습니다. `status=success`라도 반드시 서버에서 API를 호출하여 실제 결제 상태를 확인해야 합니다.
:::

`paymentId`를 수신하면 서버에서 `GET /merchant/payments/:id`를 호출하여 최종 상태를 검증합니다.

```bash
curl https://gateway.dev.solonetwork.io/merchant/payments/0xabc123... \
  -H "x-api-key: sk_xxxxx"
```

**검증 체크리스트**

- [ ] `status === 'PAID'` 확인 (결제 성공)
- [ ] `amount`가 **자사 주문 DB에 저장된 기대 금액**과 일치 확인 (위젯은 클라이언트에서 실행되므로 금액이 변조될 수 있음)
- [ ] `recipientAddress`가 가맹점 지갑 주소와 일치 확인 (공격자가 수신자를 바꿔치기하는 자기결제 공격 방지)
- [ ] `tokenAddress`가 기대한 토큰과 일치 확인
- [ ] `orderId`가 기대한 orderId와 일치 확인
- [ ] 동일 `paymentId`의 중복 완료 처리 방지

## 한계 및 주의 사항

- Callback URL은 **브라우저 리다이렉트 기반**이므로 네트워크 장애 등으로 유실될 수 있습니다.
- 사용자가 결제 중간에 브라우저를 닫거나 네트워크가 끊기면 `successUrl`/`failUrl`에 도달하지 못할 수 있습니다.
- Callback URL **단독으로는 결제 결과 수신을 보장할 수 없습니다**.

## Webhook 병행 권장

Callback URL의 한계를 보완하기 위해, 반드시 **Webhook과 함께 사용**하는 것을 권장합니다.

| 방식         | 전달 경로 | 신뢰성 | 용도                      |
| ------------ | --------- | ------ | ------------------------- |
| Callback URL | 브라우저  | 낮음   | 사용자에게 결과 화면 표시 |
| Webhook      | 서버      | 높음   | 서버에서 주문 상태 갱신   |

- Callback URL — 사용자 경험(결과 페이지 표시)에 활용
- Webhook — 서버 사이드에서 주문 완료 처리에 활용
- 두 채널 모두에서 `GET /merchant/payments/:id`로 최종 검증 필수

## 다음 단계

- [Webhook 가이드](/ko/webhooks/) — 서버 사이드 결제 알림 수신
- [결제 상태 조회](/ko/payments/) — API로 결제 상태 확인
