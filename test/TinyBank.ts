import hre from "hardhat";
import { expect } from "chai";
import { DECIMALS, MINTING_AMOUNT } from "./constant";
import { MyToken, TinyBank } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("TinyBank", () => {
    let signers: HardhatEthersSigner[];
    let myTokenC: MyToken;
    let tinyBankC: TinyBank;

    let owner: HardhatEthersSigner;
    let manager1: HardhatEthersSigner;
    let manager2: HardhatEthersSigner;
    let manager3: HardhatEthersSigner;
    let manager4: HardhatEthersSigner;
    let manager5: HardhatEthersSigner;
    let nonManager: HardhatEthersSigner;
    let managers: HardhatEthersSigner[];
    let managerAddresses: string[];

    beforeEach(async () => {
        signers = await hre.ethers.getSigners();
        
        [owner, manager1, manager2, manager3, manager4, manager5, nonManager] = signers;
        managers = [manager1, manager2, manager3, manager4, manager5];
        managerAddresses = managers.map(m => m.address);

        myTokenC = await hre.ethers.deployContract("MyToken", [
            "MyToken",
            "MT",
            DECIMALS,
            MINTING_AMOUNT,
        ]);

        tinyBankC = await hre.ethers.deployContract("TinyBank", [
            await myTokenC.getAddress(), // IMyToken _stakingToken
            owner.address,             // address _owner
            managerAddresses           // address[5] memory _managers
        ]);
        await myTokenC.setManager(await tinyBankC.getAddress());
    });

    describe("initialized state check", () => {
        it("should return totalStaked 0", async () => {
            expect(await tinyBankC.totalStaked()).equal(0);
        });
        it("should return staked 0 amount of signer0", async () => {
            const signer0 = signers[0]; // owner
            expect(await tinyBankC.staked(signer0.address)).equal(0);
        })
    });
    describe("Staking", async () => {
        it("should return staked amount", async () => {
            const signer0 = signers[0]; // owner
            const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
            
            await myTokenC.connect(signer0).approve(await tinyBankC.getAddress(), stakingAmount);
            await tinyBankC.connect(signer0).stake(stakingAmount);
            
            expect(await tinyBankC.staked(signer0.address)).equal(stakingAmount);
            expect(await myTokenC.balanceOf(await tinyBankC.getAddress())).equal(
                await tinyBankC.totalStaked()
            );
        });
    });
    describe("Withdraw", () => {
        it("should return 0 staked after withdrawing total token", async () => {
            const signer0 = signers[0]; // owner
            const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
            await myTokenC.connect(signer0).approve(await tinyBankC.getAddress(), stakingAmount);
            await tinyBankC.connect(signer0).stake(stakingAmount);
            
            await tinyBankC.connect(signer0).withdraw(stakingAmount);
            expect(await tinyBankC.staked(signer0.address)).equal(0);
        });
    });
    describe("reward", () => {
        it("should reward 1MT every blocks", async () => {
            const signer0 = signers[0]; // owner
            const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
            await myTokenC.connect(signer0).approve(await tinyBankC.getAddress(), stakingAmount);
            await tinyBankC.connect(signer0).stake(stakingAmount);

            const BLOCKS = 5n;
            const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
            for(var i=0; i<BLOCKS; i++) {
                await myTokenC.connect(owner).transfer(transferAmount, owner.address);
            }
            
            await tinyBankC.connect(signer0).withdraw(stakingAmount);
            
            expect(await myTokenC.balanceOf(signer0.address)).equal(
                hre.ethers.parseUnits((MINTING_AMOUNT + BLOCKS + 1n).toString())
            );
        });
    });

    describe("TinyBank Multi-Manager Access Control", () => {
        it("should revert with 'You are not one of managers' if a non-manager tries to confirm", async () => {
            await expect(
                tinyBankC.connect(nonManager).confirm()
            ).to.be.revertedWith("You are not one of managers");
        });
        it("should revert with 'Not all managers confirmed yet' if not all managers have confirmed", async () => {
            const newRewardAmount = hre.ethers.parseUnits("2", DECIMALS); // 2 MT

            await tinyBankC.connect(manager1).confirm();
            await tinyBankC.connect(manager2).confirm();
            await tinyBankC.connect(manager3).confirm();
            await tinyBankC.connect(manager4).confirm();

            await expect(
                tinyBankC.connect(owner).setRewardPerBlock(newRewardAmount)
            ).to.be.revertedWith("Not all managers confirmed yet");
        });
        it("should set reward per block after all managers confirm", async () => {
            const newRewardAmount = hre.ethers.parseUnits("2", DECIMALS); // 2 MT

            for (const manager of managers) {
                await tinyBankC.connect(manager).confirm();
            }

            await expect(
                tinyBankC.connect(owner).setRewardPerBlock(newRewardAmount)
            ).to.not.be.reverted;

            expect(await tinyBankC.rewardPerBlock()).to.equal(newRewardAmount);
        });

        it("should reset confirmations after a successful call", async () => {
            const amount1 = hre.ethers.parseUnits("2", DECIMALS);
            const amount2 = hre.ethers.parseUnits("3", DECIMALS);

            for (const manager of managers) {
                await tinyBankC.connect(manager).confirm();
            }

            await tinyBankC.connect(owner).setRewardPerBlock(amount1);
            expect(await tinyBankC.rewardPerBlock()).to.equal(amount1);

            await expect(
                tinyBankC.connect(owner).setRewardPerBlock(amount2)
            ).to.be.revertedWith("Not all managers confirmed yet");
        });
    });
});