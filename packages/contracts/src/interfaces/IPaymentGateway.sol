// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPaymentGateway
 * @author Solo Pay Team
 * @notice Interface for the PaymentGateway contract
 */
interface IPaymentGateway {
  enum PaymentStatus {
    None,
    Paid,
    Refunded
  }

  struct Payment {
    address payer;
    uint16 feeBps;
    PaymentStatus status;
    address token;
    address recipient;
    uint256 amount;
    bytes32 merchantId;
  }

  struct PermitSignature {
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  // ============ Events ============

  /// @notice Emitted when the treasury address is changed
  /// @param oldTreasuryAddress The previous treasury address
  /// @param newTreasuryAddress The new treasury address
  event TreasuryChanged(address indexed oldTreasuryAddress, address indexed newTreasuryAddress);

  /// @notice Emitted when the fee basis points is changed
  /// @param oldFeeBps The previous fee in basis points
  /// @param newFeeBps The new fee in basis points
  event FeeBpsChanged(uint16 oldFeeBps, uint16 newFeeBps);

  /// @notice Emitted when a token's whitelist status is changed
  /// @param tokenAddress The token address
  /// @param supported Whether the token is now supported
  event TokenSupportChanged(address indexed tokenAddress, bool indexed supported);

  /// @notice Emitted when a payment is completed
  /// @param paymentId Unique payment identifier
  /// @param merchantId Merchant identifier
  /// @param payerAddress Address of the payer
  /// @param recipientAddress Address of the recipient
  /// @param tokenAddress Address of the ERC20 token
  /// @param amount Payment amount
  /// @param fee Fee amount sent to treasury
  /// @param timestamp Block timestamp
  event PaymentCompleted(
    bytes32 indexed paymentId,
    bytes32 indexed merchantId,
    address indexed payerAddress,
    address recipientAddress,
    address tokenAddress,
    uint256 amount,
    uint256 fee,
    uint256 timestamp
  );

  /// @notice Emitted when stuck tokens are rescued by the owner
  /// @param tokenAddress Address of the rescued token (address(0) for ETH)
  /// @param to Address that received the rescued tokens
  /// @param amount Amount of tokens rescued
  event TokensRescued(address indexed tokenAddress, address indexed to, uint256 amount);

  /// @notice Emitted when a payment is refunded
  /// @param originalPaymentId Original payment identifier
  /// @param merchantId Merchant identifier
  /// @param payerAddress Address of the payer (refund recipient)
  /// @param merchantAddress Address of the merchant (refund sender)
  /// @param tokenAddress Address of the ERC20 token
  /// @param amount Refunded amount
  /// @param timestamp Block timestamp
  event RefundCompleted(
    bytes32 indexed originalPaymentId,
    bytes32 indexed merchantId,
    address indexed payerAddress,
    address merchantAddress,
    address tokenAddress,
    uint256 amount,
    uint256 timestamp
  );

  // ============ Core Functions ============

  /// @notice Initialize the contract
  /// @param owner Address of the contract owner
  /// @param treasury Address of the treasury to receive fees
  function initialize(address owner, address treasury) external;

  /// @notice Pay directly to merchant with fee deduction
  /// @param paymentId Unique payment identifier
  /// @param tokenAddress ERC20 token address
  /// @param amount Payment amount
  /// @param recipientAddress Merchant's wallet address
  /// @param merchantId Merchant identifier
  /// @param deadline Payment expiration timestamp (0 to skip)
  /// @param permit ERC20 Permit signature (deadline=0 to skip)
  function pay(
    bytes32 paymentId,
    address tokenAddress,
    uint256 amount,
    address recipientAddress,
    bytes32 merchantId,
    uint256 deadline,
    PermitSignature calldata permit
  ) external;

  /// @notice Refund a paid payment - full amount returned from merchant to payer
  /// @param originalPaymentId The paid payment ID
  /// @param permit Permit signature for gasless token approval
  function refund(
    bytes32 originalPaymentId,
    PermitSignature calldata permit
  ) external;

  // ============ Admin Functions ============

  /// @notice Set the treasury address
  /// @param newTreasuryAddress The new treasury address
  function setTreasury(address newTreasuryAddress) external;

  /// @notice Set the fee in basis points
  /// @param newFeeBps The new fee in basis points (0-10000)
  function setFeeBps(uint16 newFeeBps) external;

  /// @notice Set whether a token is supported
  /// @param tokenAddress The token address
  /// @param supported Whether the token should be supported
  function setSupportedToken(address tokenAddress, bool supported) external;

  /// @notice Set whether token whitelist is enforced
  /// @param enforce Whether to enforce the whitelist
  function setEnforceTokenWhitelist(bool enforce) external;

  /// @notice Batch set supported tokens
  /// @param tokenAddresses Array of token addresses
  /// @param supportedFlags Array of supported flags
  function batchSetSupportedTokens(address[] calldata tokenAddresses, bool[] calldata supportedFlags) external;

  /// @notice Pause the contract
  function pause() external;

  /// @notice Unpause the contract
  function unpause() external;

  /// @notice Rescue ERC20 tokens accidentally sent to this contract
  /// @param tokenAddress The ERC20 token to rescue
  /// @param to The address to send rescued tokens to
  /// @param amount The amount of tokens to rescue
  function rescueERC20(address tokenAddress, address to, uint256 amount) external;

  /// @notice Rescue ETH accidentally sent to this contract
  /// @param to The address to send rescued ETH to
  function rescueETH(address payable to) external;

  // ============ View Functions ============

  /// @notice Check if a token is supported
  /// @param tokenAddress The token address to check
  /// @return True if the token is supported
  function supportedTokens(address tokenAddress) external view returns (bool);

  /// @notice Check if a payment has been processed
  /// @param paymentId The payment ID to check
  /// @return True if the payment has been processed
  function isPaymentProcessed(bytes32 paymentId) external view returns (bool);

  /// @notice Check if a payment has been refunded
  /// @param paymentId The payment ID to check
  /// @return True if the payment has been refunded
  function isPaymentRefunded(bytes32 paymentId) external view returns (bool);

  /// @notice Get the status of a payment
  /// @param paymentId The payment ID to check
  /// @return The payment status (0=None, 1=Paid, 2=Refunded)
  function getPaymentStatus(bytes32 paymentId) external view returns (PaymentStatus);

  /// @notice Get full payment data
  /// @param paymentId The payment ID to query
  /// @return The Payment struct
  function getPayment(bytes32 paymentId) external view returns (Payment memory);

  /// @notice Get the trusted forwarder address
  /// @return The trusted forwarder address
  function getTrustedForwarder() external view returns (address);
}
