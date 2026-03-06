# 환불 (Refunds)

환불은 이미 **finalized**(확정)된 결제, 즉 자금이 가맹점에게 해제된 이후 구매자에게 금액을 돌려줄 때 사용합니다. 완료된 결제에 대한 환불은 Refunds API를 사용하세요.

::: info 환불(Refund) vs 취소(Cancel)

- **취소(Cancel)** — 결제가 아직 **ESCROWED**(에스크로) 상태일 때 사용. **POST /payments/:id/cancel** 호출로 확정 전 구매자에게 자금 반환. [결제 확정 및 취소](/ko/payments/finalize) 참조.
- **환불(Refund)** — 결제가 이미 **FINALIZED**(확정)된 경우 사용. **POST /refunds** 호출로 구매자에게 환불. 이 페이지는 환불(Refund) 흐름을 설명합니다.
  :::

## 사용 시점

- 결제 상태가 **FINALIZED**이며, 가맹점이 이미 자금을 수령한 경우.
- 구매자에게 전액 또는 일부를 반환해야 할 때 (예: 고객 요청, 주문 취소).

## 환불 전: 가맹점 승인(approve) 필요

온체인 환불 트랜잭션이 성공하려면 **가맹점 지갑(수취인 주소)**이 결제 토큰의 환불 금액에 대해 **Payment Gateway 컨트랙트의 spend 권한을 승인(approve)**해 두어야 합니다. 토큰 컨트랙트에서 ERC20 `approve(gatewayAddress, amount)`를 호출하면 됩니다. 게이트웨이는 이 단계를 대신 수행하지 않으며, 가맹점이 직접 수행해야 합니다(ERC20 Permit 지원 시 Permit 사용 가능). 승인하지 않으면 온체인 환불 트랜잭션이 실패합니다. Refund API는 온체인 승인 여부를 검사하지 않고, 인증 및 결제 상태만 검증한 뒤 서버 서명을 반환합니다.

## 흐름

1. 결제가 **FINALIZED** 상태 (자금 가맹점 지갑).
2. 가맹점은 수취인 지갑이 해당 토큰에 대해 게이트웨이를 **승인(approve)**했는지 확인 (위 참조).
3. 가맹점 서버에서 **POST /refunds** 호출 (`paymentId`, 선택 사항 `reason`). 인증: `x-api-key`. API는 환불 레코드와 **서버 서명**을 반환하며, relayer로 트랜잭션을 제출하지 않습니다.
4. 가맹점(또는 relayer)이 게이트웨이 컨트랙트의 `refund(paymentId, serverSignature, permit)`를 호출하여 온체인 환불 트랜잭션을 제출합니다.
5. 트랜잭션 제출 및 확정에 따라 환불 상태: **PENDING** → **SUBMITTED** → **CONFIRMED** (또는 **FAILED**).
6. **GET /refunds/:refundId** 또는 **GET /refunds**로 상태 조회.

결제 상태는 온체인 환불이 확정되면 **REFUND_SUBMITTED** → **REFUNDED**로 표시됩니다.

## API 요약

| 동작           | 엔드포인트                 | 인증        |
| -------------- | -------------------------- | ----------- |
| 환불 요청      | **POST /refunds**          | `x-api-key` |
| 환불 상태 조회 | **GET /refunds/:refundId** | `x-api-key` |
| 환불 목록 조회 | **GET /refunds**           | `x-api-key` |

**POST /refunds** 요청 본문: `{ "paymentId": "0x...", "reason": "고객 요청" }` (reason 선택).

## 전체 API 명세

요청/응답 스키마, 상태 값, 에러 코드는 [API 전체 명세의 환불 섹션](/ko/api/#refunds)을 참조하세요.

## 다음 단계

- [결제 확정 및 취소](/ko/payments/finalize) — 에스크로 결제 해제 또는 취소 (확정 전)
- [결제 상태](/ko/payments/status) — REFUND_SUBMITTED, REFUNDED 포함 상태 값
- [에러 코드](/ko/api/errors) — API 에러 처리
