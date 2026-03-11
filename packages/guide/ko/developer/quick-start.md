# 빠른 시작

5분 안에 SoloPay를 연동하는 방법을 알아봅니다.

## 사전 준비

- API Key 및 Public Key (관리자로부터 발급)
- Node.js 18 이상

## Step 1: 자사 DB에 주문 생성

결제 위젯을 호출하기 전에, 서버에서 주문을 생성하고 DB에 저장합니다.

- **orderId**: 가맹점 내에서 고유한 주문 식별자입니다. SoloPay는 가맹점별 중복을 허용하지 않으며, 중복된 `orderId`는 `DUPLICATE_ORDER` 에러로 거부됩니다.
- **기대 금액과 토큰 주소를 함께 저장**: `orderId`와 함께 기대 금액(`amount`)과 토큰 주소(`tokenAddress`)를 저장하세요. 결제 완료 후 검증 시 이 값과 대조합니다 (Step 4 참조).
- **서버 사이드 저장 필수**: 위젯은 사용자 브라우저에서 실행되므로 `amount` 등의 파라미터가 변조될 수 있습니다. 검증에는 서버에 저장된 값만 신뢰할 수 있습니다.
- **orderId로 결제 조회**: `paymentId`를 아직 모르는 상황에서 `orderId`로 결제를 조회할 수 있습니다. `GET /merchant/payments?orderId=xxx` (API Key 인증 필요)

## Step 2: 결제 위젯 열기

`@solo-pay/widget-js`로 결제 위젯을 엽니다. 위젯이 결제 생성, 지갑 연결, 서명, 결제 처리를 모두 담당합니다.

```bash
npm install @solo-pay/widget-js
```

```typescript
import { SoloPay } from '@solo-pay/widget-js';

const solopay = new SoloPay({
  publicKey: 'pk_xxxxx',
});

solopay.requestPayment({
  orderId: 'order-001',
  amount: '10.5',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  successUrl: 'https://yourshop.com/payment/success',
  failUrl: 'https://yourshop.com/payment/fail',
});
```

React 프로젝트라면 [`@solo-pay/widget-react`의 `useWidget` 훅](/ko/widget/)을 사용하는 것을 권장합니다.

Vanilla JS 또는 기타 프레임워크에서는 CDN으로 바로 사용할 수 있습니다.

```html
<script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
<script>
  const solopay = new SoloPay({ publicKey: 'pk_xxxxx' });
  solopay.requestPayment({
    orderId: 'order-001',
    amount: '10.5',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    successUrl: 'https://yourshop.com/payment/success',
    failUrl: 'https://yourshop.com/payment/fail',
  });
</script>
```

## Step 3: 결제 결과 수신

결제가 완료되면 두 가지 경로로 결과를 수신합니다.

### Callback URL (프론트엔드)

Step 2에서 지정한 `successUrl` 또는 `failUrl`로 사용자가 리다이렉트됩니다. `paymentId`, `orderId`, `status`가 쿼리 파라미터로 전달됩니다.

- `successUrl` — `status=success` (결제 성공)
- `failUrl` — `status=fail` (결제 실패) 또는 `status=closed` (사용자가 위젯을 닫음)

```
https://yourshop.com/payment/success?paymentId=0xabc123...&orderId=order-001&status=success
https://yourshop.com/payment/fail?paymentId=0xabc123...&orderId=order-001&status=closed
```

::: warning Callback URL만으로는 부족합니다
Callback은 브라우저 리다이렉트 기반이므로 네트워크 장애 등으로 유실될 수 있습니다. 반드시 Webhook과 함께 사용하세요.
:::

### Webhook (서버)

가맹점 관리자에게 Webhook URL을 등록하면, 결제 상태가 변경될 때마다 서버로 HTTP POST 알림을 수신합니다.

주요 이벤트:

- `payment.paid` — 결제가 온체인에서 확인됨
- `payment.invalid` — 결제 검증 실패

```json
{
  "paymentId": "0xabc123...",
  "orderId": "order-001",
  "status": "PAID",
  "txHash": "0xdef789...",
  "amount": "10500000000000000000",
  "tokenSymbol": "SUT",
  "paidAt": "2024-01-26T12:35:00.000Z"
}
```

Webhook 상세는 [Webhook 가이드](/ko/webhooks/)를 참조하세요.

## Step 4: 결제 상태 검증 (필수)

Callback이든 Webhook이든, `paymentId`를 수신하면 반드시 서버에서 **Merchant API**를 호출하여 최종 상태를 확인합니다. URL 파라미터나 Webhook payload를 그대로 신뢰하지 마세요.

::: warning Public Key로 검증하면 안 됩니다
Public Key(`pk_xxxxx`)는 위젯 초기화 전용입니다. 서버 사이드 검증에는 반드시 **API Key**(`sk_xxxxx`)를 사용하세요.
:::

**paymentId로 조회:**

```bash
curl https://gateway.dev.solonetwork.io/merchant/payments/0xabc123... \
  -H "x-api-key: sk_xxxxx"
```

**orderId로 조회** (`paymentId`를 모르는 경우):

```bash
curl "https://gateway.dev.solonetwork.io/merchant/payments?orderId=order-001" \
  -H "x-api-key: sk_xxxxx"
```

**검증 체크리스트**

- [ ] `status === 'PAID'` 확인 (결제 성공)
- [ ] `amount`가 **자사 주문 DB에 저장된 기대 금액**과 일치 확인 (위젯은 클라이언트에서 실행되므로 금액이 변조될 수 있음)
- [ ] `tokenAddress`가 기대한 토큰과 일치 확인
- [ ] `orderId`가 기대한 orderId와 일치 확인
- [ ] 동일 `paymentId`의 중복 완료 처리 방지

## Step 5: PAID 확인 후 주문 완료

결제 상태가 **PAID**이면, 결제가 온체인에서 확인되었고 자금이 가맹점 지갑으로 직접 전송된 것입니다. 추가 API 호출이 필요하지 않습니다.

`GET /payments/:id` 또는 `payment.paid` 웹훅에서 `status === 'PAID'`를 확인한 후 주문 완료 처리(상품 발송, 서비스 활성화 등)를 진행합니다.

::: tip 직접 결제 모델
에스크로 기반 시스템과 달리, SoloPay는 결제 시 자금을 가맹점에 직접 전송합니다. 별도의 확정(finalize) 단계가 없습니다.
:::

## 결제 상태 흐름

```
CREATED ──► PAID
CREATED ──► EXPIRED
CREATED ──► FAILED
CREATED ──► INVALID
```

| 상태      | 설명                     |
| --------- | ------------------------ |
| `CREATED` | 결제 생성됨              |
| `PAID`    | 결제가 온체인에서 확인됨 |
| `INVALID` | 결제 검증 실패           |
| `FAILED`  | 트랜잭션 실패            |
| `EXPIRED` | 만료 (5분 초과)          |

## 다음 단계

- [Webhook 가이드](/ko/webhooks/) - Webhook 이벤트 상세 및 검증
- [결제 상태](/ko/payments/status) - 전체 결제 상태 값
- [인증](/ko/developer/authentication) - API Key / Public Key 상세 사용법
- [결제 생성 API](/ko/payments/create) - 결제 API 상세 가이드
