import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { PaymentGatewayV1, MockERC20, ERC2771Forwarder } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// Zero permit for skipping permit (using traditional approve)
const ZERO_PERMIT = {
  deadline: 0n,
  v: 0,
  r: ethers.ZeroHash,
  s: ethers.ZeroHash,
};

// PaymentStatus enum values matching contract
const Status = {
  None: 0n,
  Paid: 1n,
  Refunded: 2n,
};

describe('PaymentGatewayV1', function () {
  // Helper: create ERC20 Permit signature
  async function createPermitSignature(
    token: MockERC20,
    owner: HardhatEthersSigner,
    spender: string,
    value: bigint,
    deadline: bigint
  ) {
    const nonce = await token.nonces(owner.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const tokenAddress = await token.getAddress();
    const name = await token.name();

    const domain = {
      name,
      version: '1',
      chainId,
      verifyingContract: tokenAddress,
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const message = {
      owner: owner.address,
      spender,
      value,
      nonce,
      deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    const sig = ethers.Signature.from(signature);

    return {
      deadline,
      v: sig.v,
      r: sig.r,
      s: sig.s,
    };
  }

  // Test fixture: deploy contracts
  async function deployFixture() {
    const [owner, treasury, payer, other, merchantRecipient] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory('MockERC20');
    const token = (await MockToken.deploy('Test Token', 'TEST', 18)) as unknown as MockERC20;
    await token.waitForDeployment();

    const mintAmount = ethers.parseEther('10000');
    await token.mint(payer.address, mintAmount);

    const Forwarder = await ethers.getContractFactory('ERC2771Forwarder');
    const forwarder = (await Forwarder.deploy('SoloForwarder')) as unknown as ERC2771Forwarder;
    await forwarder.waitForDeployment();

    const PaymentGateway = await ethers.getContractFactory('PaymentGatewayV1');
    const gateway = (await upgrades.deployProxy(
      PaymentGateway,
      [owner.address, treasury.address],
      {
        kind: 'uups',
        initializer: 'initialize',
        constructorArgs: [await forwarder.getAddress()],
      }
    )) as unknown as PaymentGatewayV1;
    await gateway.waitForDeployment();

    const merchantId = ethers.id('MERCHANT_001');

    return {
      gateway,
      forwarder,
      token,
      owner,
      treasury,
      payer,
      other,
      merchantRecipient,
      merchantId,
    };
  }

  // Helper fixture: make a paid payment (for refund tests)
  async function makePaymentFixture() {
    const fixture = await loadFixture(deployFixture);
    const { gateway, token, payer, merchantRecipient, merchantId } = fixture;

    const paymentId = ethers.id('PAID_PAYMENT_001');
    const amount = ethers.parseEther('100');
    const feeBps = 500; // 5%

    await gateway.setFeeBps(feeBps);

    await token.connect(payer).approve(await gateway.getAddress(), amount);

    await gateway
      .connect(payer)
      .pay(
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        ZERO_PERMIT
      );

    return { ...fixture, paymentId, amount, feeBps };
  }

  // ============ Deployment ============

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);
      expect(await gateway.owner()).to.equal(owner.address);
    });

    it('Should set the correct trusted forwarder', async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);
      expect(await gateway.getTrustedForwarder()).to.equal(await forwarder.getAddress());
    });

    it('Should not enforce token whitelist by default', async function () {
      const { gateway } = await loadFixture(deployFixture);
      expect(await gateway.enforceTokenWhitelist()).to.equal(false);
    });

    it('Should set the correct treasury', async function () {
      const { gateway, treasury } = await loadFixture(deployFixture);
      expect(await gateway.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should have zero fee by default', async function () {
      const { gateway } = await loadFixture(deployFixture);
      expect(await gateway.feeBps()).to.equal(0);
    });
  });

  // ============ Payment (Direct Transfer) ============

  describe('Payment', function () {
    it('Should transfer tokens directly to merchant and emit PaymentCompleted', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_001');
      const amount = ethers.parseEther('100');

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      const payerBalanceBefore = await token.balanceOf(payer.address);
      const recipientBalanceBefore = await token.balanceOf(merchantRecipient.address);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          0n, // zero fee
          (timestamp: bigint) => timestamp > 0n
        );

      // Payer balance decreased
      expect(await token.balanceOf(payer.address)).to.equal(payerBalanceBefore - amount);
      // Recipient received full amount (no fee)
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(
        recipientBalanceBefore + amount
      );
      // Contract should NOT hold any tokens
      expect(await token.balanceOf(await gateway.getAddress())).to.equal(0n);

      // Payment status should be Paid
      expect(await gateway.getPaymentStatus(paymentId)).to.equal(Status.Paid);
      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);

      // Payment struct should be populated
      const payment = await gateway.getPayment(paymentId);
      expect(payment.payer).to.equal(payer.address);
      expect(payment.token).to.equal(await token.getAddress());
      expect(payment.amount).to.equal(amount);
      expect(payment.recipient).to.equal(merchantRecipient.address);
      expect(payment.merchantId).to.equal(merchantId);
      expect(payment.feeBps).to.equal(0);
    });

    it('Should reject duplicate payment ID', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_002');
      const amount = ethers.parseEther('50');

      await token.connect(payer).approve(await gateway.getAddress(), amount * 2n);

      // First payment
      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          ZERO_PERMIT
        );

      // Second payment with same ID should fail
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWith('PG: already processed');
    });

    it('Should reject zero amount', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_003');

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            0,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWith('PG: amount must be > 0');
    });

    it('Should reject zero token address', async function () {
      const { gateway, payer, merchantRecipient, merchantId } = await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_005');
      const amount = ethers.parseEther('10');

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            ethers.ZeroAddress,
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWith('PG: invalid token');
    });

    it('Should reject zero recipient address', async function () {
      const { gateway, token, payer, merchantId } = await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_006');
      const amount = ethers.parseEther('10');

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            ethers.ZeroAddress,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWith('PG: invalid recipient');
    });

    it('Should reject fee over 100%', async function () {
      const { gateway } = await loadFixture(deployFixture);

      await expect(gateway.setFeeBps(10001)).to.be.revertedWith('PG: fee too high');
    });

    it('Should reject insufficient token allowance', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('ORDER_NO_APPROVE');
      const amount = ethers.parseEther('10');

      // No approve - should fail
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientAllowance');
    });
  });

  // ============ Fee Mechanism ============

  describe('Fee Mechanism', function () {
    it('Should split payment at pay time: fee to treasury, rest to recipient', async function () {
      const { gateway, token, treasury, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const feeBps = 500; // 5%
      const paymentId = ethers.id('FEE_ORDER_001');
      const amount = ethers.parseEther('100');

      await gateway.setFeeBps(feeBps);

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      const expectedFee = (amount * BigInt(feeBps)) / 10000n;
      const expectedRecipientAmount = amount - expectedFee;

      const treasuryBalanceBefore = await token.balanceOf(treasury.address);
      const recipientBalanceBefore = await token.balanceOf(merchantRecipient.address);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          expectedFee,
          (timestamp: bigint) => timestamp > 0n
        );

      // Fee goes to treasury, rest to recipient
      expect(await token.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + expectedFee
      );
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(
        recipientBalanceBefore + expectedRecipientAmount
      );
      // Contract holds nothing
      expect(await token.balanceOf(await gateway.getAddress())).to.equal(0n);
    });

    it('Should have zero fee when feeBps is 0', async function () {
      const { gateway, token, treasury, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('NO_FEE_ORDER');
      const amount = ethers.parseEther('100');

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          ZERO_PERMIT
        );

      // Full amount goes to recipient, nothing to treasury
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
    });

    it('Should handle maximum fee (10000 bps = 100%) correctly', async function () {
      const { gateway, token, payer, treasury, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('MAX_FEE_ORDER');
      const amount = ethers.parseEther('100');
      const feeBps = 10000; // 100%

      await gateway.setFeeBps(feeBps);

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          ZERO_PERMIT
        );

      // All fee to treasury, nothing to recipient
      expect(await token.balanceOf(treasury.address)).to.equal(amount);
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(0n);
    });

    it('Should record feeBps in payment struct', async function () {
      const { gateway, paymentId, feeBps } = await makePaymentFixture();

      const payment = await gateway.getPayment(paymentId);
      expect(payment.feeBps).to.equal(feeBps);
    });
  });

  // ============ Token Whitelist ============

  describe('Token Whitelist', function () {
    it('Should allow owner to set supported token', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setSupportedToken(await token.getAddress(), true))
        .to.emit(gateway, 'TokenSupportChanged')
        .withArgs(await token.getAddress(), true);

      expect(await gateway.supportedTokens(await token.getAddress())).to.equal(true);
    });

    it('Should reject non-owner setting supported token', async function () {
      const { gateway, token, other } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).setSupportedToken(await token.getAddress(), true)
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should enforce whitelist when enabled', async function () {
      const { gateway, token, payer, owner, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      // Enable whitelist enforcement
      await gateway.connect(owner).setEnforceTokenWhitelist(true);

      const paymentId = ethers.id('ORDER_WL_001');
      const amount = ethers.parseEther('10');

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Should fail - token not whitelisted
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWith('PG: token not supported');

      // Add token to whitelist
      await gateway.connect(owner).setSupportedToken(await token.getAddress(), true);

      // Now should succeed
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.emit(gateway, 'PaymentCompleted');
    });

    it('Should batch set supported tokens', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      const tokens = [await token.getAddress(), ethers.Wallet.createRandom().address];
      const supported = [true, true];

      await gateway.connect(owner).batchSetSupportedTokens(tokens, supported);

      expect(await gateway.supportedTokens(tokens[0])).to.equal(true);
      expect(await gateway.supportedTokens(tokens[1])).to.equal(true);
    });

    it('Should reject batch with length mismatch', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(owner).batchSetSupportedTokens([await token.getAddress()], [true, false])
      ).to.be.revertedWith('PG: length mismatch');
    });

    it('Should reject zero address in setSupportedToken', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(owner).setSupportedToken(ethers.ZeroAddress, true)
      ).to.be.revertedWith('PG: invalid token');
    });
  });

  // ============ Meta Transaction ============

  describe('Meta Transaction', function () {
    it('Should process meta-transaction payment via forwarder', async function () {
      const { gateway, forwarder, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('META_ORDER_001');
      const amount = ethers.parseEther('25');

      // Approve token spending
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Encode the pay function call
      const data = gateway.interface.encodeFunctionData('pay', [
        paymentId,
        await token.getAddress(),
        amount,
        merchantRecipient.address,
        merchantId,
        ZERO_PERMIT,
      ]);

      // Get nonce for payer (OZ v5 format)
      const nonce = await forwarder.nonces(payer.address);
      const forwarderDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Sign the request using EIP-712 (OZ v5 format)
      const domain = {
        name: 'SoloForwarder',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await forwarder.getAddress(),
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const message = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        nonce: nonce,
        deadline: forwarderDeadline,
        data: data,
      };

      const forwarderSignature = await payer.signTypedData(domain, types, message);

      // OZ v5 ForwardRequestData struct (includes signature, excludes nonce)
      const requestData = {
        from: payer.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        deadline: forwarderDeadline,
        data: data,
        signature: forwarderSignature,
      };

      // Execute via forwarder (anyone can submit)
      await expect(forwarder.execute(requestData)).to.emit(gateway, 'PaymentCompleted');

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);
      expect(await gateway.getPaymentStatus(paymentId)).to.equal(Status.Paid);

      // Tokens should be at recipient (direct transfer)
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
    });

    it('Should process meta-transaction refund via forwarder', async function () {
      const { gateway, forwarder, token, payer, merchantRecipient, paymentId, amount } =
        await makePaymentFixture();

      // Merchant needs tokens to refund - they already have some from the payment (minus fee)
      const feeAmount = (amount * BigInt(500)) / 10000n;

      // Mint extra tokens to cover the full refund amount
      await token.mint(merchantRecipient.address, feeAmount);
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      // Encode the refund function call
      const data = gateway.interface.encodeFunctionData('refund', [paymentId, ZERO_PERMIT]);

      // Get nonce for merchant
      const nonce = await forwarder.nonces(merchantRecipient.address);
      const forwarderDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Sign the forward request
      const domain = {
        name: 'SoloForwarder',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await forwarder.getAddress(),
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      const message = {
        from: merchantRecipient.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        nonce: nonce,
        deadline: forwarderDeadline,
        data: data,
      };

      const forwarderSignature = await merchantRecipient.signTypedData(domain, types, message);

      const requestData = {
        from: merchantRecipient.address,
        to: await gateway.getAddress(),
        value: 0n,
        gas: 500000n,
        deadline: forwarderDeadline,
        data: data,
        signature: forwarderSignature,
      };

      const payerBalanceBefore = await token.balanceOf(payer.address);

      // Execute via forwarder
      await expect(forwarder.execute(requestData)).to.emit(gateway, 'RefundCompleted');

      // Verify refund
      expect(await gateway.isPaymentRefunded(paymentId)).to.equal(true);
      const payerBalanceAfter = await token.balanceOf(payer.address);
      expect(payerBalanceAfter - payerBalanceBefore).to.equal(amount);
    });
  });

  // ============ Upgrade ============

  describe('Upgrade', function () {
    it('Should allow owner to upgrade', async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);

      const PaymentGatewayV2 = await ethers.getContractFactory('PaymentGatewayV1');

      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: 'uups',
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.not.be.reverted;
    });

    it('Should reject non-owner upgrade', async function () {
      const { gateway, forwarder, other } = await loadFixture(deployFixture);

      const PaymentGatewayV2 = await ethers.getContractFactory('PaymentGatewayV1', other);

      await expect(
        upgrades.upgradeProxy(await gateway.getAddress(), PaymentGatewayV2, {
          kind: 'uups',
          constructorArgs: [await forwarder.getAddress()],
        })
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });
  });

  // ============ View Functions ============

  describe('View Functions', function () {
    it('Should return correct payment status', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('VIEW_ORDER_001');
      const amount = ethers.parseEther('10');

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(false);
      expect(await gateway.getPaymentStatus(paymentId)).to.equal(Status.None);

      await token.connect(payer).approve(await gateway.getAddress(), amount);
      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          ZERO_PERMIT
        );

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);
      expect(await gateway.getPaymentStatus(paymentId)).to.equal(Status.Paid);
    });

    it('Should return correct payment data via getPayment', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId, paymentId, amount, feeBps } =
        await makePaymentFixture();

      const payment = await gateway.getPayment(paymentId);

      expect(payment.payer).to.equal(payer.address);
      expect(payment.token).to.equal(await token.getAddress());
      expect(payment.amount).to.equal(amount);
      expect(payment.recipient).to.equal(merchantRecipient.address);
      expect(payment.merchantId).to.equal(merchantId);
      expect(payment.feeBps).to.equal(feeBps);
    });

    it('Should return empty payment for non-existent ID', async function () {
      const { gateway } = await loadFixture(deployFixture);

      const nonExistentId = ethers.id('NON_EXISTENT');
      const payment = await gateway.getPayment(nonExistentId);

      expect(payment.payer).to.equal(ethers.ZeroAddress);
      expect(payment.amount).to.equal(0n);
    });

    it('Should return treasury address', async function () {
      const { gateway, treasury } = await loadFixture(deployFixture);

      expect(await gateway.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should return trusted forwarder address', async function () {
      const { gateway, forwarder } = await loadFixture(deployFixture);

      expect(await gateway.getTrustedForwarder()).to.equal(await forwarder.getAddress());
    });
  });

  // ============ Admin Functions ============

  describe('Admin Functions', function () {
    it('Should allow owner to set treasury', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      const newTreasury = ethers.Wallet.createRandom().address;

      await expect(gateway.connect(owner).setTreasury(newTreasury))
        .to.emit(gateway, 'TreasuryChanged')
        .withArgs(await gateway.treasuryAddress(), newTreasury);

      expect(await gateway.treasuryAddress()).to.equal(newTreasury);
    });

    it('Should reject non-owner setting treasury', async function () {
      const { gateway, other } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).setTreasury(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should reject zero address as treasury', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.revertedWith(
        'PG: invalid treasury'
      );
    });

    it('Should allow owner to set fee', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await expect(gateway.connect(owner).setFeeBps(300))
        .to.emit(gateway, 'FeeBpsChanged')
        .withArgs(0, 300);

      expect(await gateway.feeBps()).to.equal(300);
    });

    it('Should reject non-owner setting fee', async function () {
      const { gateway, other } = await loadFixture(deployFixture);

      await expect(gateway.connect(other).setFeeBps(300)).to.be.revertedWithCustomError(
        gateway,
        'OwnableUnauthorizedAccount'
      );
    });

    it('Should allow owner to pause and unpause', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await gateway.connect(owner).pause();

      // Payment should be rejected when paused
      // (we test this indirectly - any whenNotPaused function should fail)

      await gateway.connect(owner).unpause();
    });

    it('Should reject non-owner pause', async function () {
      const { gateway, other } = await loadFixture(deployFixture);

      await expect(gateway.connect(other).pause()).to.be.revertedWithCustomError(
        gateway,
        'OwnableUnauthorizedAccount'
      );
    });

    it('Should reject payment when paused', async function () {
      const { gateway, token, payer, owner, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      await gateway.connect(owner).pause();

      const paymentId = ethers.id('PAUSED_ORDER');
      const amount = ethers.parseEther('10');

      await token.connect(payer).approve(await gateway.getAddress(), amount);

      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.be.revertedWithCustomError(gateway, 'EnforcedPause');
    });
  });

  // ============ Rescue Functions ============

  describe('Rescue Functions', function () {
    it('Should rescue ERC20 tokens accidentally sent to the contract', async function () {
      const { gateway, token, owner, treasury } = await loadFixture(deployFixture);

      const stuckAmount = ethers.parseEther('50');

      // Simulate stuck tokens by directly transferring to contract
      await token.mint(await gateway.getAddress(), stuckAmount);
      expect(await token.balanceOf(await gateway.getAddress())).to.equal(stuckAmount);

      // Owner rescues tokens
      await expect(
        gateway.connect(owner).rescueERC20(await token.getAddress(), treasury.address, stuckAmount)
      )
        .to.emit(gateway, 'TokensRescued')
        .withArgs(await token.getAddress(), treasury.address, stuckAmount);

      expect(await token.balanceOf(await gateway.getAddress())).to.equal(0n);
      expect(await token.balanceOf(treasury.address)).to.equal(stuckAmount);
    });

    it('Should reject non-owner rescueERC20', async function () {
      const { gateway, token, other, treasury } = await loadFixture(deployFixture);

      await token.mint(await gateway.getAddress(), ethers.parseEther('10'));

      await expect(
        gateway
          .connect(other)
          .rescueERC20(await token.getAddress(), treasury.address, ethers.parseEther('10'))
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should reject rescueERC20 to zero address', async function () {
      const { gateway, token, owner } = await loadFixture(deployFixture);

      await token.mint(await gateway.getAddress(), ethers.parseEther('10'));

      await expect(
        gateway
          .connect(owner)
          .rescueERC20(await token.getAddress(), ethers.ZeroAddress, ethers.parseEther('10'))
      ).to.be.revertedWith('PG: invalid recipient');
    });

    it('Should rescue ETH sent via selfdestruct', async function () {
      const { gateway, owner, treasury } = await loadFixture(deployFixture);

      // Simulate ETH stuck in contract (e.g. via selfdestruct)
      await ethers.provider.send('hardhat_setBalance', [
        await gateway.getAddress(),
        '0xDE0B6B3A7640000', // 1 ETH
      ]);

      const contractBalance = await ethers.provider.getBalance(await gateway.getAddress());
      expect(contractBalance).to.equal(ethers.parseEther('1'));

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      await expect(gateway.connect(owner).rescueETH(treasury.address))
        .to.emit(gateway, 'TokensRescued')
        .withArgs(ethers.ZeroAddress, treasury.address, ethers.parseEther('1'));

      expect(await ethers.provider.getBalance(await gateway.getAddress())).to.equal(0n);
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(
        treasuryBalanceBefore + ethers.parseEther('1')
      );
    });

    it('Should reject non-owner rescueETH', async function () {
      const { gateway, other, treasury } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(other).rescueETH(treasury.address)
      ).to.be.revertedWithCustomError(gateway, 'OwnableUnauthorizedAccount');
    });

    it('Should reject rescueETH when no ETH to rescue', async function () {
      const { gateway, owner, treasury } = await loadFixture(deployFixture);

      await expect(
        gateway.connect(owner).rescueETH(treasury.address)
      ).to.be.revertedWith('PG: no ETH to rescue');
    });

    it('Should reject rescueETH to zero address', async function () {
      const { gateway, owner } = await loadFixture(deployFixture);

      await ethers.provider.send('hardhat_setBalance', [
        await gateway.getAddress(),
        '0xDE0B6B3A7640000',
      ]);

      await expect(
        gateway.connect(owner).rescueETH(ethers.ZeroAddress)
      ).to.be.revertedWith('PG: invalid recipient');
    });
  });

  // ============ Refund ============

  describe('Refund', function () {
    it('Should process refund successfully', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId, paymentId, amount } =
        await makePaymentFixture();

      // Merchant received amount minus fee in the initial payment
      const feeBps = 500;
      const feeAmount = (amount * BigInt(feeBps)) / 10000n;

      // Mint extra tokens to merchant to cover full refund
      await token.mint(merchantRecipient.address, feeAmount);
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      const payerBalanceBefore = await token.balanceOf(payer.address);

      await expect(gateway.connect(merchantRecipient).refund(paymentId, ZERO_PERMIT))
        .to.emit(gateway, 'RefundCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          (timestamp: bigint) => timestamp > 0n
        );

      // Verify refund status
      expect(await gateway.getPaymentStatus(paymentId)).to.equal(Status.Refunded);
      expect(await gateway.isPaymentRefunded(paymentId)).to.equal(true);

      // Verify payer received tokens back (full original amount)
      const payerBalanceAfter = await token.balanceOf(payer.address);
      expect(payerBalanceAfter - payerBalanceBefore).to.equal(amount);
    });

    it('Should reject refund for non-existent payment', async function () {
      const { gateway, merchantRecipient } = await loadFixture(deployFixture);

      const nonExistentPaymentId = ethers.id('NON_EXISTENT_PAYMENT');

      await expect(
        gateway.connect(merchantRecipient).refund(nonExistentPaymentId, ZERO_PERMIT)
      ).to.be.revertedWith('PG: not paid');
    });

    it('Should reject duplicate refund', async function () {
      const { gateway, token, merchantRecipient, paymentId, amount } =
        await makePaymentFixture();

      // Mint extra tokens to merchant for refund
      await token.mint(merchantRecipient.address, amount);
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount * 2n);

      // First refund should succeed
      await gateway.connect(merchantRecipient).refund(paymentId, ZERO_PERMIT);

      // Second refund should fail (status is now Refunded, not Paid)
      await expect(
        gateway.connect(merchantRecipient).refund(paymentId, ZERO_PERMIT)
      ).to.be.revertedWith('PG: not paid');
    });

    it('Should reject refund from non-recipient', async function () {
      const { gateway, payer, paymentId } = await makePaymentFixture();

      // Payer (not the merchant/recipient) tries to call refund
      await expect(
        gateway.connect(payer).refund(paymentId, ZERO_PERMIT)
      ).to.be.revertedWith('PG: not recipient');
    });

    it('Should reject refund when paused', async function () {
      const { gateway, token, owner, merchantRecipient, paymentId, amount } =
        await makePaymentFixture();

      await token.mint(merchantRecipient.address, amount);
      await token.connect(merchantRecipient).approve(await gateway.getAddress(), amount);

      await gateway.connect(owner).pause();

      await expect(
        gateway.connect(merchantRecipient).refund(paymentId, ZERO_PERMIT)
      ).to.be.revertedWithCustomError(gateway, 'EnforcedPause');
    });
  });

  // ============ ERC20 Permit Support ============

  describe('ERC20 Permit Support', function () {
    it('Should accept payment with valid permit signature', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('PERMIT_ORDER_001');
      const amount = ethers.parseEther('50');

      // Create permit signature (no approve needed!)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const permit = await createPermitSignature(
        token,
        payer,
        await gateway.getAddress(),
        amount,
        deadline
      );

      // Make payment with permit (NO prior approve needed)
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            permit
          )
      )
        .to.emit(gateway, 'PaymentCompleted')
        .withArgs(
          paymentId,
          merchantId,
          payer.address,
          merchantRecipient.address,
          await token.getAddress(),
          amount,
          0n, // no fee
          (timestamp: bigint) => timestamp > 0n
        );

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);
      // Tokens should be at recipient (direct transfer)
      expect(await token.balanceOf(merchantRecipient.address)).to.equal(amount);
    });

    it('Should silently ignore expired permit and fail on insufficient allowance', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('PERMIT_ORDER_002');
      const amount = ethers.parseEther('50');

      // Create permit with past deadline
      const expiredDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago
      const permit = await createPermitSignature(
        token,
        payer,
        await gateway.getAddress(),
        amount,
        expiredDeadline
      );

      // With try/catch permit pattern, expired permit is silently ignored.
      // Without prior approve, transferFrom fails with ERC20InsufficientAllowance.
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            permit
          )
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientAllowance');
    });

    it('Should allow traditional approve flow when permit deadline is 0', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      const paymentId = ethers.id('TRADITIONAL_ORDER_001');
      const amount = ethers.parseEther('50');

      // Traditional approve
      await token.connect(payer).approve(await gateway.getAddress(), amount);

      // Make payment with ZERO_PERMIT (traditional flow)
      await expect(
        gateway
          .connect(payer)
          .pay(
            paymentId,
            await token.getAddress(),
            amount,
            merchantRecipient.address,
            merchantId,
            ZERO_PERMIT
          )
      ).to.emit(gateway, 'PaymentCompleted');

      expect(await gateway.isPaymentProcessed(paymentId)).to.equal(true);
    });

    it('Should work with permit for refund', async function () {
      const { gateway, token, payer, merchantRecipient, merchantId } =
        await loadFixture(deployFixture);

      // Make a payment first (no fee for simplicity)
      const paymentId = ethers.id('REFUND_PERMIT_001');
      const amount = ethers.parseEther('100');

      await token.connect(payer).approve(await gateway.getAddress(), amount);
      await gateway
        .connect(payer)
        .pay(
          paymentId,
          await token.getAddress(),
          amount,
          merchantRecipient.address,
          merchantId,
          ZERO_PERMIT
        );

      // Create permit for refund (merchant approving gateway)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const permit = await createPermitSignature(
        token,
        merchantRecipient,
        await gateway.getAddress(),
        amount,
        deadline
      );

      // Process refund with permit (NO prior approve needed)
      await expect(
        gateway.connect(merchantRecipient).refund(paymentId, permit)
      ).to.emit(gateway, 'RefundCompleted');

      expect(await gateway.isPaymentRefunded(paymentId)).to.equal(true);
    });
  });
});
