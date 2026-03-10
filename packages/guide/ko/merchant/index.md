# 상점

가맹점 설정 및 관리에 대한 가이드입니다.

## 가맹점 등록

SoloPay를 사용하려면 먼저 SoloPay 운영팀에 가맹점 등록을 요청해야 합니다. 등록 시 아래 정보가 필요합니다.

- 서비스(쇼핑몰 등) 도메인 주소
- 사용할 체인 (예: Polygon Amoy 80002)
- 수령 지갑 주소 (결제 금액을 받을 ERC-20 토큰 지갑)
- 결제에 사용할 토큰 주소

등록이 완료되면 운영팀으로부터 API Key와 Public Key를 발급받습니다.

## API 인증

SoloPay API는 엔드포인트 종류에 따라 두 가지 인증 방식을 사용합니다. 가맹점 등록 후 운영팀으로부터 두 가지 키를 발급받습니다.

### Public Key (x-public-key)

- 프론트엔드(클라이언트 사이드)에서 사용합니다.
- 접두사: `pk_...`
- 결제 생성(`POST /payments`), 결제 상태 조회(`GET /payments/:id`), Relay 제출(`POST /payments/:id/relay`)에 사용됩니다.
- 브라우저에서 노출 가능하지만, `Origin` 헤더로 도메인 검증이 적용됩니다.

### API Key (x-api-key)

- 백엔드(서버 사이드)에서만 사용합니다.
- 접두사: `sk_...`
- 가맹점 정보 조회(`GET /merchant`), 결제 내역 조회(`GET /merchant/payments`), 환불(`POST /refunds`)에 사용됩니다.
- 절대 프론트엔드 코드에 노출하지 마세요.

::: danger API Key 보안
`sk_`로 시작하는 API Key는 절대 프론트엔드 코드에 포함하지 마세요. API Key는 관리/설정 목적으로만 사용되며, 클라이언트 사이드 위젯 연동에는 필요하지 않습니다.
:::

## 결제 수단 활성화

가맹점 등록 후 결제에 사용할 토큰을 활성화해야 합니다. 이 단계는 클라이언트 사이드 연동과 별개로 진행하는 1회성 관리 설정입니다.

- SoloPay 운영팀에 문의하거나 대시보드를 통해 결제 수단을 활성화합니다.
- API를 직접 사용하는 경우 `POST /merchant/payment-methods` 엔드포인트에 API Key(`sk_...`)가 필요합니다.
- 활성화된 결제 수단은 `GET /merchant/payment-methods` 엔드포인트로 조회할 수 있습니다.
- 기존 결제 수단의 활성화/비활성화는 `PATCH /merchant/payment-methods/:id` 엔드포인트로 변경할 수 있습니다.

::: tip Permit(EIP-2612) 지원 토큰
USDC 등 EIP-2612를 지원하는 토큰은 최초 결제 시에도 Approve 트랜잭션 없이 100% 가스리스 결제가 가능합니다.
:::

## 가맹점 정보 조회

`GET /merchant` 엔드포인트로 현재 가맹점 정보를 조회할 수 있습니다. API Key(`x-api-key`) 인증이 필요합니다.

```bash
curl https://gateway.dev.solonetwork.io/api/v1/merchant \
  -H "x-api-key: sk_xxxxx"
```

```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": 1,
      "merchant_key": "my-store",
      "name": "My Store",
      "chain_id": 80002,
      "chain": { "id": 1, "network_id": 80002, "name": "Polygon Amoy", "is_testnet": true },
      "webhook_url": null,
      "public_key": "pk_xxx",
      "is_enabled": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "payment_methods": [...]
    },
    "chainTokens": [...]
  }
}
```

응답에는 가맹점 기본 정보, 연결된 체인 정보, 활성화된 결제 수단 목록, 그리고 해당 체인에서 사용 가능한 토큰 목록이 포함됩니다.

## 보안 권장사항

**해야 할 것**

- API Key를 환경 변수로 관리하세요.
- 서버 사이드에서만 API Key를 사용하세요.
- 가능하면 Origin 도메인 제한을 설정하세요.

**하지 말아야 할 것**

- 클라이언트 코드에 API Key를 노출하지 마세요.
- 버전 관리 시스템(Git 등)에 키를 커밋하지 마세요.
- 로그에 키를 출력하지 마세요.

**환경 변수 설정 예시**

```bash
SOLO_PAY_API_KEY=sk_xxxxx
SOLO_PAY_PUBLIC_KEY=pk_xxxxx
```

**Origin 검증**

서버에 `ALLOWED_WIDGET_ORIGIN` 환경 변수가 설정된 경우, `Origin` 헤더를 검증합니다. 브라우저에서 호출 시 `Origin`은 자동으로 설정됩니다.

```bash
ALLOWED_WIDGET_ORIGIN=https://yourshop.com
```

::: danger 금지
API Key(`sk_`)를 프론트엔드에 절대 포함하지 마세요. Public Key(`pk_`)만 클라이언트 측에 사용하세요.
:::

## 다음 단계

- [빠른 시작](/ko/developer/quick-start) - 첫 결제 연동
- [결제](/ko/payments/) - 결제 API 상세
