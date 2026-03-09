# 빠른 시작

5분 안에 SoloPay를 연동하는 방법을 알아봅니다.

## 사전 준비

- API Key 및 Public Key (관리자로부터 발급)
- Node.js 18 이상

## Step 1: 결제 위젯 열기

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

## Step 2: 결제 결과 수신

결제가 완료되면 두 가지 경로로 결과를 수신합니다.

### Callback URL (프론트엔드)

Step 1에서 지정한 `successUrl` 또는 `failUrl`로 사용자가 리다이렉트됩니다. `paymentId`, `orderId`, `status`가 쿼리 파라미터로 전달됩니다.

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

- `payment.escrowed` — 사용자 결제 완료, 에스크로 보관
- `payment.finalized` — 자금이 상점 지갑으로 해제됨

```json
{
  "event": "payment.escrowed",
  "data": {
    "paymentId": "0xabc123...",
    "status": "ESCROWED",
    "amount": "10500000000000000000",
    "orderId": "order-001"
  }
}
```

Webhook 상세는 [Webhook 가이드](/ko/webhooks/)를 참조하세요.

## Step 3: 결제 상태 검증 (필수)

Callback이든 Webhook이든, `paymentId`를 수신하면 반드시 서버에서 API를 호출하여 최종 상태를 확인합니다. URL 파라미터나 Webhook payload를 그대로 신뢰하지 마세요.

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

`status`가 `ESCROWED`이고, `amount`, `tokenAddress`, `orderId`가 주문 정보와 일치하면 결제가 유효합니다. Step 4에서 finalize를 호출하여 결제를 확정합니다.

## Step 4: 결제 확정 또는 취소

결제가 **ESCROWED** 상태가 되면, 주문 내용을 검증한 뒤 확정 또는 취소를 호출합니다.

- **확정** — 자금을 상점 지갑으로 해제합니다.
- **취소** — 상품 품절, 주문 정보 불일치 등의 사유로 자금을 구매자에게 환불합니다.

```bash
# 확정
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../finalize \
  -H "x-api-key: sk_xxxxx"

# 취소
curl -X POST https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123.../cancel \
  -H "x-api-key: sk_xxxxx"
```

::: warning 반드시 확정 또는 취소를 호출하세요
에스크로 기한이 지나면 확정할 수 없으며, 누구나 온체인에서 cancel을 호출하여 구매자에게 환불할 수 있는 상태가 됩니다.
:::

상세는 [결제 확정 및 취소](/ko/payments/finalize)를 참조하세요.

## Step 5: FINALIZED 확인 후 주문 완료

::: danger FINALIZED 전에 주문을 완료하지 마세요
finalize를 호출해도 블록체인 네트워크 이슈로 트랜잭션이 실패할 수 있습니다. 반드시 `FINALIZED` 상태를 확인한 후에만 주문을 완료 처리하세요.
:::

finalize 호출 후 상태는 `FINALIZE_SUBMITTED` → `FINALIZED`로 전환됩니다. 다음 두 가지 방법으로 `FINALIZED`를 확인합니다.

- **Webhook** — `payment.finalized` 이벤트 수신 후, `GET /payments/:id`를 호출하여 `FINALIZED` 상태를 재확인
- **API 폴링** — `GET /payments/:id`를 주기적으로 호출하여 `status === 'FINALIZED'` 확인

```bash
curl https://gateway.dev.solonetwork.io/api/v1/payments/0xabc123... \
  -H "x-public-key: pk_xxxxx"
```

`FINALIZED` 상태를 확인한 후에만 상품 발송, 서비스 활성화 등 주문 완료 처리를 진행합니다.

## 결제 상태 흐름

```
CREATED ──► ESCROWED ──► FINALIZE_SUBMITTED ──► FINALIZED
                    └──► CANCEL_SUBMITTED   ──► CANCELLED
CREATED ──► EXPIRED
CREATED ──► FAILED
```

| 상태        | 설명                       |
| ----------- | -------------------------- |
| `CREATED`   | 결제 생성됨                |
| `ESCROWED`  | 사용자 결제 완료, 에스크로 |
| `FINALIZED` | 자금 상점으로 확정됨       |
| `FAILED`    | 트랜잭션 실패              |
| `EXPIRED`   | 만료 (5분 초과)            |

## 다음 단계

- [Webhook 가이드](/ko/webhooks/) - Webhook 이벤트 상세 및 검증
- [결제 확정 및 취소](/ko/payments/finalize) - 에스크로 결제 확정/취소
- [인증](/ko/developer/authentication) - API Key / Public Key 상세 사용법
- [결제 생성 API](/ko/payments/create) - 결제 API 상세 가이드
