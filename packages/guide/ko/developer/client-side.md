# 클라이언트 사이드 연동 가이드

SoloPay 결제창(UI)으로 리다이렉트하는 방식의 연동 가이드입니다.

## 전체 플로우

```
1. [가맹점 프론트엔드] 위젯 호출 (orderId, amount, tokenAddress 전달)
        ↓
2. [SoloPay 위젯] 결제 생성 + 지갑 연결 + 결제 처리
        ↓
3. [SoloPay] 결제 완료 후 successUrl 또는 failUrl로 리다이렉트
        ↓
4. [가맹점 프론트엔드] 결제 결과 API 교차 검증 (필수)
```

위젯이 결제 생성부터 지갑 연결, 서명, 처리까지 모두 담당합니다. 가맹점은 **위젯 호출과 결과 검증**만 구현하면 됩니다.

## Step 1: 위젯으로 결제 열기

`@solo-pay/widget-js` SDK를 사용해 결제 위젯을 엽니다. React 프로젝트라면 [`@solo-pay/widget-react`의 `useWidget` 훅](/ko/widget/)을 사용하는 것을 권장합니다.

```bash
npm install @solo-pay/widget-js
```

```typescript
import { SoloPay } from '@solo-pay/widget-js';

const solopay = new SoloPay({
  publicKey: 'pk_test_xxxxx', // 발급받은 Public Key
});

solopay.requestPayment({
  orderId: 'order-001', // 가맹점 주문 ID
  amount: '10.5', // 결제 금액
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  successUrl: 'https://yourshop.com/payment/success',
  failUrl: 'https://yourshop.com/payment/fail',
});
```

## Step 2: Callback URL 처리

결제 완료 후 SoloPay는 결제 생성 시 지정한 `successUrl` 또는 `failUrl`로 사용자를 리다이렉트합니다.

```
https://yourshop.com/payment/success?paymentId=0xabc123...
https://yourshop.com/payment/fail?paymentId=0xabc123...&reason=expired
```

::: warning 프론트엔드 결과를 신뢰하지 마세요
URL 파라미터는 사용자가 조작할 수 있습니다. 반드시 **API를 통해 결제 상태를 최종 확인**하세요.
:::

## Step 3: 결제 결과 교차 검증 (필수)

사용자가 Callback URL로 리다이렉트되면, `orderId`를 기반으로 서버에서 결제 API를 조회하여 검증합니다.

```typescript
// 1. orderId는 세션/주문 컨텍스트에서 가져옴 (URL 파라미터를 신뢰하지 말 것)
const orderId = getOrderIdFromSession();

// 2. 서버에서 orderId로 SoloPay API 조회
const response = await fetch(
  `https://pay-api.staging.sut.com/api/v1/payments?orderId=${orderId}`,
  { headers: { 'x-api-key': 'sk_test_xxxxx' } }
);
const payment = await response.json();

// 3. 검증 후 paymentId 연결
if (payment.status === 'ESCROWED' || payment.status === 'FINALIZED') {
  await updateOrder(orderId, { paymentId: payment.paymentId, status: 'PAID' });
}
```

**검증 체크리스트**

- [ ] `orderId`로 결제 API 조회 — callback URL 값을 그대로 쓰지 말 것
- [ ] `status === 'ESCROWED'` 또는 `status === 'FINALIZED'` 확인
- [ ] `amount`, `tokenAddress`가 주문 정보와 일치 확인
- [ ] `paymentId`를 주문에 연결
- [ ] 동일 `paymentId`의 중복 완료 처리 방지

## Webhook 연동 (권장)

Callback URL 방식은 사용자가 브라우저를 닫으면 실패할 수 있습니다. **Webhook과 함께 사용**하면 사용자가 성공 페이지로 돌아오지 않아도 결제 완료를 안정적으로 수신할 수 있습니다.

- [Webhook 설정 가이드 보기](/ko/webhooks/)

## 다음 단계

- [Webhook 설정](/ko/webhooks/) — 안정적인 결제 상태 수신
