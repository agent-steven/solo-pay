// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ERC2771ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPaymentGateway } from "./interfaces/IPaymentGateway.sol";

/**
 * @title PaymentGatewayV1
 * @author Solo Pay Team
 * @notice Direct payment gateway with fee collection and meta-transaction support
 * @dev Uses UUPS proxy pattern for upgradeability and ERC2771 for meta-transactions
 *
 * Payment flow:
 * - pay(): Payer sends tokens directly to merchant (fee deducted to treasury)
 * - refund(): Merchant sends full amount back to payer
 *
 * @custom:security-contact security@sut.com
 */
contract PaymentGatewayV1 is
  UUPSUpgradeable,
  OwnableUpgradeable,
  ERC2771ContextUpgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable,
  IPaymentGateway
{
  using SafeERC20 for IERC20;

  /// @notice Maximum fee percentage (100% = 10000 basis points)
  uint16 public constant MAX_FEE_BPS = 10000;

  /// @notice Payment data by paymentId
  mapping(bytes32 => Payment) public payments;

  /// @notice Mapping of token addresses to their supported status
  mapping(address => bool) public supportedTokens;

  /// @notice Whether token whitelist is enforced
  bool public enforceTokenWhitelist;

  /// @notice Address of the treasury
  address public treasuryAddress;

  /// @notice Fee in basis points applied to payments (0-10000)
  uint16 public feeBps;

  /// @notice Initialize the trusted forwarder and disable initializers
  /// @param trustedForwarderAddress Address of the ERC2771 trusted forwarder
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address trustedForwarderAddress) ERC2771ContextUpgradeable(trustedForwarderAddress) {
    _disableInitializers();
  }

  /**
   * @notice Initialize the contract
   * @param owner Address of the contract owner
   * @param treasury Address of the treasury
   */
  function initialize(address owner, address treasury) public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(owner);
    __ReentrancyGuard_init();
    __Pausable_init();

    enforceTokenWhitelist = false;
    _setTreasury(treasury);
  }

  /**
   * @notice Internal function to set treasury address
   * @dev Emits TreasuryChanged event
   * @param newTreasuryAddress The new treasury address
   */
  function _setTreasury(address newTreasuryAddress) internal {
    require(newTreasuryAddress != address(0), "PG: invalid treasury");
    address oldTreasuryAddress = treasuryAddress;
    treasuryAddress = newTreasuryAddress;
    emit TreasuryChanged(oldTreasuryAddress, newTreasuryAddress);
  }

  /**
   * @notice Set the treasury address
   * @dev Only callable by owner
   * @param newTreasuryAddress The new treasury address
   */
  function setTreasury(address newTreasuryAddress) external onlyOwner {
    _setTreasury(newTreasuryAddress);
  }

  /**
   * @notice Set the fee in basis points
   * @dev Only callable by owner
   * @param newFeeBps The new fee in basis points (0-10000)
   */
  function setFeeBps(uint16 newFeeBps) external onlyOwner {
    require(newFeeBps <= MAX_FEE_BPS, "PG: fee too high");
    uint16 oldFeeBps = feeBps;
    feeBps = newFeeBps;
    emit FeeBpsChanged(oldFeeBps, newFeeBps);
  }

  /**
   * @notice Pause all payment operations
   * @dev Only callable by owner
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpause all payment operations
   * @dev Only callable by owner
   */
  function unpause() external onlyOwner {
    _unpause();
  }

  /**
   * @notice Pay directly to merchant with fee deduction
   * @dev Tokens are transferred from payer to merchant (minus fee) and fee to treasury.
   *      Uses _msgSender() to support both direct calls and meta-transactions.
   *      Supports ERC20 Permit for gasless token approval.
   * @param paymentId Unique payment identifier (bytes32)
   * @param tokenAddress ERC20 token address
   * @param amount Payment amount in token's smallest unit
   * @param recipientAddress Merchant's wallet address
   * @param merchantId Merchant identifier (bytes32)
   * @param permit ERC20 Permit signature (deadline=0 to skip)
   */
  function pay(
    bytes32 paymentId,
    address tokenAddress,
    uint256 amount,
    address recipientAddress,
    bytes32 merchantId,
    IPaymentGateway.PermitSignature calldata permit
  ) external nonReentrant whenNotPaused {
    address payerAddress = _msgSender();

    _validatePayment(paymentId, tokenAddress, amount, recipientAddress);
    _tryPermit(tokenAddress, payerAddress, amount, permit);

    uint256 feeAmount = (amount * feeBps) / MAX_FEE_BPS;
    uint256 recipientAmount = amount - feeAmount;

    payments[paymentId] = Payment({
      payer: payerAddress,
      feeBps: feeBps,
      status: PaymentStatus.Paid,
      token: tokenAddress,
      recipient: recipientAddress,
      amount: amount,
      merchantId: merchantId
    });

    IERC20(tokenAddress).safeTransferFrom(payerAddress, recipientAddress, recipientAmount);
    if (feeAmount > 0) {
      IERC20(tokenAddress).safeTransferFrom(payerAddress, treasuryAddress, feeAmount);
    }

    emit PaymentCompleted(
      paymentId,
      merchantId,
      payerAddress,
      recipientAddress,
      tokenAddress,
      amount,
      feeAmount,
      block.timestamp
    );
  }

  /**
   * @notice Internal function to validate payment inputs
   * @param paymentId Payment identifier
   * @param tokenAddress Token address
   * @param amount Payment amount
   * @param recipientAddress Recipient address
   */
  function _validatePayment(
    bytes32 paymentId,
    address tokenAddress,
    uint256 amount,
    address recipientAddress
  ) internal view {
    require(treasuryAddress != address(0), "PG: treasury not set");
    require(payments[paymentId].status == PaymentStatus.None, "PG: already processed");
    require(amount > 0, "PG: amount must be > 0");
    require(tokenAddress != address(0), "PG: invalid token");
    require(recipientAddress != address(0), "PG: invalid recipient");
    if (enforceTokenWhitelist) {
      require(supportedTokens[tokenAddress], "PG: token not supported");
    }
  }

  /**
   * @notice Try to execute ERC20 Permit, silently ignore if it fails
   * @param tokenAddress Token address
   * @param owner Token owner address
   * @param amount Approval amount
   * @param permit Permit signature (deadline=0 to skip)
   */
  function _tryPermit(
    address tokenAddress,
    address owner,
    uint256 amount,
    IPaymentGateway.PermitSignature calldata permit
  ) internal {
    if (permit.deadline > 0) {
      try
        IERC20Permit(tokenAddress).permit(
          owner,
          address(this),
          amount,
          permit.deadline,
          permit.v,
          permit.r,
          permit.s
        )
      {} catch {}
    }
  }

  /**
   * @notice Set whether a token is supported
   * @dev Only callable by owner
   * @param tokenAddress The token address
   * @param supported Whether the token should be supported
   */
  function setSupportedToken(address tokenAddress, bool supported) external onlyOwner {
    require(tokenAddress != address(0), "PG: invalid token");
    supportedTokens[tokenAddress] = supported;
    emit TokenSupportChanged(tokenAddress, supported);
  }

  /**
   * @notice Set whether token whitelist is enforced
   * @dev Only callable by owner
   * @param enforce Whether to enforce the whitelist
   */
  function setEnforceTokenWhitelist(bool enforce) external onlyOwner {
    enforceTokenWhitelist = enforce;
  }

  /**
   * @notice Batch set supported tokens
   * @dev Only callable by owner, useful for initial setup
   * @param tokenAddresses Array of token addresses
   * @param supported Array of support statuses
   */
  function batchSetSupportedTokens(
    address[] calldata tokenAddresses,
    bool[] calldata supported
  ) external onlyOwner {
    require(tokenAddresses.length == supported.length, "PG: length mismatch");

    for (uint256 i = 0; i < tokenAddresses.length; ++i) {
      require(tokenAddresses[i] != address(0), "PG: invalid token");
      supportedTokens[tokenAddresses[i]] = supported[i];
      emit TokenSupportChanged(tokenAddresses[i], supported[i]);
    }
  }

  // ============ Refund Functions ============

  /**
   * @notice Refund a paid payment - merchant sends full amount back to payer
   * @dev Only callable by original recipient (merchant).
   *      All refund data (token, amount, payer) is read from on-chain storage.
   *      Uses _msgSender() to support both direct calls and meta-transactions.
   *      Supports ERC20 Permit for gasless token approval.
   * @param originalPaymentId The paid payment ID to refund
   * @param permit Permit signature for gasless token approval (deadline=0 to skip)
   */
  function refund(
    bytes32 originalPaymentId,
    IPaymentGateway.PermitSignature calldata permit
  ) external nonReentrant whenNotPaused {
    Payment storage p = payments[originalPaymentId];
    require(p.status == PaymentStatus.Paid, "PG: not paid");

    address merchantAddress = _msgSender();
    require(merchantAddress == p.recipient, "PG: not recipient");

    _tryPermit(p.token, merchantAddress, p.amount, permit);

    p.status = PaymentStatus.Refunded;

    IERC20(p.token).safeTransferFrom(merchantAddress, p.payer, p.amount);

    emit RefundCompleted(
      originalPaymentId,
      p.merchantId,
      p.payer,
      merchantAddress,
      p.token,
      p.amount,
      block.timestamp
    );
  }

  /**
   * @notice Check if a payment has been refunded
   * @param paymentId The payment ID to check
   * @return True if the payment has been refunded
   */
  function isPaymentRefunded(bytes32 paymentId) external view returns (bool) {
    return payments[paymentId].status == PaymentStatus.Refunded;
  }

  // ============ Rescue Functions ============

  /**
   * @notice Rescue ERC20 tokens accidentally sent to this contract
   * @dev Only callable by owner. Safe because this contract never holds tokens in normal operation.
   * @param tokenAddress The ERC20 token to rescue
   * @param to The address to send rescued tokens to
   * @param amount The amount of tokens to rescue
   */
  function rescueERC20(address tokenAddress, address to, uint256 amount) external onlyOwner nonReentrant {
    require(to != address(0), "PG: invalid recipient");
    IERC20(tokenAddress).safeTransfer(to, amount);
    emit TokensRescued(tokenAddress, to, amount);
  }

  /**
   * @notice Rescue ETH accidentally sent to this contract (e.g. via selfdestruct)
   * @dev Only callable by owner
   * @param to The address to send rescued ETH to
   */
  function rescueETH(address payable to) external onlyOwner nonReentrant {
    require(to != address(0), "PG: invalid recipient");
    uint256 balance = address(this).balance;
    require(balance > 0, "PG: no ETH to rescue");
    (bool success, ) = to.call{value: balance}("");
    require(success, "PG: ETH transfer failed");
    emit TokensRescued(address(0), to, balance);
  }

  // ============ View Functions ============

  /**
   * @notice Get the status of a payment
   * @param paymentId The payment ID to check
   * @return The payment status
   */
  function getPaymentStatus(bytes32 paymentId) external view returns (PaymentStatus) {
    return payments[paymentId].status;
  }

  /**
   * @notice Check if a payment ID has been used
   * @param paymentId The payment ID to check
   * @return True if the payment has been processed
   */
  function isPaymentProcessed(bytes32 paymentId) external view returns (bool) {
    return payments[paymentId].status != PaymentStatus.None;
  }

  /**
   * @notice Get payment data by paymentId
   * @param paymentId The payment ID to query
   * @return The Payment struct
   */
  function getPayment(bytes32 paymentId) external view returns (Payment memory) {
    return payments[paymentId];
  }

  /**
   * @notice Get the trusted forwarder address
   * @return Address of the trusted forwarder
   */
  function getTrustedForwarder() external view returns (address) {
    return trustedForwarder();
  }

  // ============ ERC2771 Overrides ============

  /**
   * @notice Get the message sender address
   * @dev Override _msgSender to support meta-transactions
   * @return The sender address (original sender in meta-tx)
   */
  function _msgSender()
    internal
    view
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (address)
  {
    return ERC2771ContextUpgradeable._msgSender();
  }

  /**
   * @notice Get the message data
   * @dev Override _msgData to support meta-transactions
   * @return The message data (stripped of suffix in meta-tx)
   */
  function _msgData()
    internal
    view
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (bytes calldata)
  {
    return ERC2771ContextUpgradeable._msgData();
  }

  /**
   * @notice Get the context suffix length
   * @dev Override _contextSuffixLength for ERC2771
   * @return The context suffix length
   */
  function _contextSuffixLength()
    internal
    view
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (uint256)
  {
    return ERC2771ContextUpgradeable._contextSuffixLength();
  }

  // ============ UUPS Override ============

  /**
   * @notice Authorize contract upgrade
   * @dev Only callable by owner
   * @param newImplementation Address of the new implementation contract
   */
  function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {
    require(newImplementation.code.length > 0, "PG: not a contract");
  }
}
