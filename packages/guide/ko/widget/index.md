# 위젯(Widget) 연동 가이드

SoloPay 결제 위젯을 사용하면 결제 UI를 직접 개발하지 않고도 결제를 연동할 수 있습니다. SDK가 지갑 연결, 서명, 결제 처리를 모두 담당합니다.

프레임워크에 따라 적합한 패키지를 선택하세요.

## React 프로젝트

`@solo-pay/widget-react` 패키지는 React 훅 방식으로 위젯을 연동합니다.

### 설치

```bash
npm install @solo-pay/widget-react
```

### 사용법

```typescript
import { useWidget } from '@solo-pay/widget-react';

function CheckoutButton({ orderId, amount }) {
  const { openWidget } = useWidget({
    publicKey: 'pk_xxxxx', // 발급받은 Public Key
    defaultPaymentRequest: {
      tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
      successUrl: 'https://myshop.com/payment/success',
      failUrl: 'https://myshop.com/payment/fail',
      currency: 'USD',
    },
    onClose: () => console.log('위젯이 닫혔습니다.'),
    onError: (err) => console.error('결제 오류:', err),
  });

  return (
    <button onClick={() => openWidget({ orderId, amount: String(amount) })}>
      결제하기
    </button>
  );
}
```

`useWidget`은 컴포넌트 마운트 시 SDK 인스턴스를 초기화하고, 언마운트 시 자동으로 정리합니다.

## Vanilla JS / 기타 프레임워크

`@solo-pay/widget-js` 패키지는 프레임워크 없이 사용할 수 있습니다.

### 설치

```bash
npm install @solo-pay/widget-js
```

### 사용법

```typescript
import { SoloPay } from '@solo-pay/widget-js';

const solopay = new SoloPay({
  publicKey: 'pk_xxxxx',
});

solopay.requestPayment(
  {
    orderId: 'order-2024-00001',
    amount: '25.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://myshop.com/payment/success',
    failUrl: 'https://myshop.com/payment/fail',
    currency: 'USD',
  },
  {
    onClose: () => {
      // 사용자가 위젯을 닫았을 때 처리
    },
  }
);
```

### CDN

npm 없이 스크립트 태그로 바로 사용할 수 있습니다.

```html
<script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
<script>
  const solopay = new SoloPay({ publicKey: 'pk_xxxxx' });
  solopay.requestPayment({
    orderId: 'order-2024-00001',
    amount: '25.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://myshop.com/payment/success',
    failUrl: 'https://myshop.com/payment/fail',
    currency: 'USD',
  });
</script>
```

## 동작 방식

- **PC 환경**: 팝업 창으로 위젯이 열립니다.
- **모바일 환경**: 전체 화면 페이지로 리다이렉트됩니다.
- 결제 완료 또는 실패 시 `successUrl` 또는 `failUrl`로 자동 리다이렉트합니다.

## Callback URL 처리

결제 완료 후 SoloPay는 결제 생성 시 지정한 `successUrl` 또는 `failUrl`로 사용자를 리다이렉트합니다. 위젯이 자동으로 `paymentId`, `orderId`, `status`를 쿼리 파라미터로 추가합니다.

| 파라미터    | 설명                                   |
| ----------- | -------------------------------------- |
| `paymentId` | 고유 결제 식별자                       |
| `orderId`   | 가맹점 주문 ID                         |
| `status`    | 결제 결과: `success`, `fail`, `closed` |

```
https://myshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://myshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=fail
https://myshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

::: warning 프론트엔드 결과를 신뢰하지 마세요
URL 파라미터는 사용자가 조작할 수 있습니다. 반드시 **API를 통해 결제 상태를 최종 확인**하세요.
:::

## 결제 결과 검증 (필수)

Callback URL에서 `paymentId`를 받은 즉시, 상태 조회 API를 호출하여 결제 상태를 검증합니다. `GET /payments/:id` 엔드포인트는 `x-public-key` 헤더를 사용하며 브라우저에서 직접 호출할 수 있습니다.

```typescript
const response = await fetch(`https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123...`, {
  headers: { 'x-public-key': 'pk_xxxxx' },
});
const result = await response.json();
```

**검증 체크리스트**

- [ ] `status === 'ESCROWED'` 확인 (결제 성공)
- [ ] `amount`가 주문 금액과 일치 확인
- [ ] `tokenAddress`가 기대한 토큰과 일치 확인
- [ ] `orderId`가 기대한 orderId와 일치 확인
- [ ] 동일 `paymentId`의 중복 완료 처리 방지
- [ ] 서버에서 finalize 호출 후, `FINALIZED` 상태를 확인한 뒤 주문 완료 처리

::: tip Webhook 연동 권장
Callback은 브라우저 리다이렉트 기반이므로 네트워크 장애 등으로 유실될 수 있습니다. **Webhook과 함께 사용**하면 결제 완료를 안정적으로 수신할 수 있습니다. [Webhook 설정 가이드 보기](/ko/webhooks/)
:::

## 다음 단계

- [Webhook 설정](/ko/webhooks/) — 안정적인 결제 완료 수신
