# 주의 사항

SoloPay를 연동할 때 반드시 알아야 할 핵심 사항을 정리합니다.

## orderId는 왜 필요한가요?

- `orderId`는 가맹점 내 중복 결제를 방지하는 멱등성(idempotency) 키입니다.
- 같은 `orderId`로 재요청하면 `DUPLICATE_ORDER` (409) 에러가 반환됩니다.
- 주문 1건 = `orderId` 1개 원칙을 지켜야 합니다.

## 사용자가 결제 중간에 창을 닫으면?

- `successUrl`/`failUrl`은 브라우저 리다이렉트에 의존하므로, 유저가 창을 닫으면 도달하지 못합니다.
- 반드시 Webhook(`ESCROWED`, `FINALIZED` 등)을 구현해야 안정적으로 결제 결과를 수신할 수 있습니다.
- Webhook + Callback URL 병행 사용을 권장합니다.
- Fallback 수단으로 `GET /payments/:id` 폴링을 활용할 수 있습니다.

## 결제 결과를 반드시 서버에서 검증하세요

- URL 쿼리 파라미터(`paymentId`, `status`)는 사용자가 조작할 수 있습니다.
- 반드시 서버에서 `GET /payments/:id`를 호출하여 실제 결제 상태를 확인해야 합니다.
- 검증 체크리스트:
  - `status`가 `ESCROWED`인지 확인 (결제 성공)
  - `amount`가 주문 금액과 일치하는지 확인
  - `tokenAddress`가 기대한 토큰인지 확인
  - `orderId`가 일치하는지 확인
  - 동일 `paymentId` 중복 처리 방지
  - finalize 호출 후, `FINALIZED` 상태를 확인한 뒤 주문 완료 처리

## Finalize/Cancel을 반드시 호출해야 하는 이유

- 결제가 `ESCROWED` 상태가 되면 자금은 스마트 컨트랙트에 잠깁니다.
- 가맹점이 명시적으로 finalize(자금 해제) 또는 cancel(구매자 환불)을 호출해야 합니다.
- 호출하지 않으면 에스크로 기한(기본 5분) 만료까지 자금이 잠긴 상태로 유지됩니다.

## Finalize를 호출하지 않으면?

- 에스크로 기한(기본 300초 = 5분) 내에 finalize를 호출하지 않으면:
  - API는 `ESCROW_EXPIRED`를 반환하며, 더 이상 확정할 수 없습니다.
  - 컨트랙트에서 permissionless cancel이 활성화되어, 누구나(구매자 포함) 온체인에서 취소를 호출할 수 있는 상태가 됩니다.
- 자금이 자동으로 돌아가지는 않습니다. 누군가가 cancel을 호출해야 구매자에게 환불됩니다.
- 결과적으로 가맹점은 매출 손실이 발생합니다.

## Cancel을 호출하지 않으면?

- 에스크로 기한 만료 후 permissionless cancel이 활성화되므로, 구매자 또는 제3자가 온체인에서 직접 cancel을 호출할 수 있습니다.
- 누군가가 호출하기 전까지 자금은 컨트랙트에 잠긴 상태로 유지됩니다. 자동 환불되지 않습니다.
- 자금이 영구적으로 잠기지는 않지만, 대기 기간 동안 사용자 경험이 저하됩니다.

## Finalize 전에 무엇을 검증해야 하나요?

- `ESCROWED` 웹훅 수신 또는 `GET /payments/:id`에서 `status === "ESCROWED"` 확인
- `amount`가 가맹점 주문 금액과 일치하는지 확인
- `orderId`가 가맹점 기록과 일치하는지 확인
- 이미 처리된 결제가 아닌지 확인 (중복 finalize 방지)

## 다음 단계

- [결제 상세](/ko/payments/) - 전체 결제 API 참고
- [웹훅 설정](/ko/webhooks/) - 결제 이벤트 수신
