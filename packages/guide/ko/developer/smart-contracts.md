# 스마트 컨트랙트 정보

SoloPay 결제 시스템을 구성하는 스마트 컨트랙트의 주소 및 핵심 인터페이스를 안내합니다.

## 네트워크별 컨트랙트 주소

::: warning 테스트넷 주소
현재는 테스트넷 환경의 주소입니다. 메인넷 주소는 추후 별도 안내됩니다.
:::

### Polygon Amoy (80002)

| 컨트랙트             | 주소                                            |
| -------------------- | ----------------------------------------------- |
| **PaymentGateway**   | `POST /payments` 응답의 `gatewayAddress` 참조   |
| **ERC2771Forwarder** | `POST /payments` 응답의 `forwarderAddress` 참조 |

::: tip 왜 주소를 직접 하드코딩하지 않나요?
컨트랙트 주소는 체인별/가맹점별로 다를 수 있으며, 업그레이드 시 변경될 수 있습니다. **결제 생성 API 응답**에 항상 최신 주소가 포함되므로, 해당 값을 신뢰하세요.

```json
{
  "gatewayAddress": "0x...", // PaymentGateway 주소
  "forwarderAddress": "0x..." // ERC2771Forwarder 주소 (없으면 Gasless 미지원)
}
```

:::

## 컨트랙트 핵심 인터페이스 (ABI)

### PaymentGateway

결제의 핵심 컨트랙트입니다. 직접 결제(사용자 전송)와 가스리스 결제(릴레이어 전송) 모두 동일한 `pay()` 함수를 사용합니다.

#### `pay()` — 결제 실행 (직접 결제 / 가스리스)

```solidity
function pay(
    bytes32 paymentId,       // 결제 고유 ID (API에서 발급)
    address tokenAddress,    // 결제에 사용할 ERC-20 토큰 주소
    uint256 amount,          // 결제 금액 (wei 단위)
    address recipientAddress,// 수령 주소 (가맹점 지갑)
    bytes32 merchantId,      // 가맹점 ID
    uint256 deadline,        // 결제 기한 (Unix timestamp, API 응답)
    PermitSignature calldata permit // EIP-2612 permit; 미사용 시 zero (deadline=0)
) external
```

`deadline`은 결제 생성/상태 API 응답에서 제공됩니다. 수수료는 컨트랙트 설정에 따라 온체인에서 적용되며, 인자로 전달하지 않습니다.

**프론트엔드 호출 예시 (wagmi) — 직접 결제**

```typescript
import { useWriteContract } from 'wagmi';

const { writeContract } = useWriteContract();

const zeroPermit = { deadline: 0, v: 0, r: '0x00...', s: '0x00...' };

await writeContract({
  address: gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [
    paymentId,
    tokenAddress,
    BigInt(amount),
    recipientAddress,
    merchantId,
    BigInt(deadline),
    zeroPermit,
  ],
});
```

**가스리스:** 동일한 `pay()` 호출을 인코딩하여 릴레이어가 `ERC2771Forwarder`로 전달합니다. 사용자는 `data`가 `pay(...)` 인코딩인 EIP-712 ForwardRequest에 서명합니다. `POST /payments/:id/relay`로 제출합니다.

### ERC2771Forwarder

OpenZeppelin의 `ERC2771Forwarder` 표준 컨트랙트입니다. 가스리스 결제에서 사용자 서명을 검증하고 `PaymentGateway`에 전달합니다.

#### `nonces()` — 사용자의 현재 nonce 조회

EIP-712 서명 생성 시 반드시 최신 nonce를 사용해야 합니다.

```typescript
// 현재 nonce 조회
const nonce = await publicClient.readContract({
  address: forwarderAddress, // API 응답의 forwarderAddress
  abi: ERC2771ForwarderABI,
  functionName: 'nonces',
  args: [userAddress],
});
```

## ForwardRequest 타입 구조

EIP-712 서명을 생성할 때 사용하는 데이터 구조입니다.

```typescript
const ForwardRequestTypes = {
  ForwardRequest: [
    { name: 'from', type: 'address' }, // 사용자 지갑 주소
    { name: 'to', type: 'address' }, // PaymentGateway 주소
    { name: 'value', type: 'uint256' }, // 항상 0 (토큰 결제)
    { name: 'gas', type: 'uint256' }, // 권장: 200000
    { name: 'nonce', type: 'uint256' }, // Forwarder에서 조회
    { name: 'deadline', type: 'uint48' }, // 서명 만료 시각 (Unix timestamp)
    { name: 'data', type: 'bytes' }, // pay() 호출 인코딩 데이터
  ],
};

const domain = {
  name: 'ERC2771Forwarder', // 고정값
  version: '1', // 고정값
  chainId: 80002, // 사용 체인 ID
  verifyingContract: forwarderAddress,
};
```

## 다음 단계

- [클라이언트 사이드 연동](/ko/developer/client-side) — 단계별 구현 가이드
- [결제 동작 원리](/ko/developer/how-it-works) — 가스리스 아키텍처 설명
