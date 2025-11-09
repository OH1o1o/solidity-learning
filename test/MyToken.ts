import hre from "hardhat";
import { expect } from "chai";
import { MyToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const mintingAcount = 100n;
const decimals = 18n;

describe("My Token", () => {
    let myTokenC: MyToken;
    let signers: HardhatEthersSigner[];
    let signer0: HardhatEthersSigner;
    let signer1: HardhatEthersSigner;

    // 'before' 대신 'beforeEach'를 사용하여 매 테스트마다 컨트랙트를 새로 배포합니다.
    // 이렇게 하면 테스트가 서로의 상태에 영향을 주지 않습니다.
    beforeEach("should deploy", async () => {
        signers = await hre.ethers.getSigners();
        [signer0, signer1] = signers; // signer0과 signer1 변수에 할당하여 사용하기 편하게 함
        
        myTokenC = await hre.ethers.deployContract("MyToken", [
            "MyToken",
            "MT",
            decimals,
            mintingAcount,
        ]);
    });

    describe("Basic state value check", () => {
        it("should return name", async () => {
            expect(await myTokenC.name()).equal("MyToken");
        });

        it("should return symbol", async () => {
            expect(await myTokenC.symbol()).equal("MT");
        });

        it("should return decimals", async () => {
            expect(await myTokenC.decimals()).equal(decimals);
        });

        it("should return 100 totalSupply", async () => {
            expect(await myTokenC.totalSupply()).equal(mintingAcount * 10n ** decimals);
        });
    });

    //1MT = 1*10^18
    describe("Mint", () => {
        it("should return 1MT balance for signer 0", async () => {
            // signer0 변수를 사용
            expect(await myTokenC.balanceOf(signer0.address)).equal(mintingAcount * 10n ** decimals);
        });
    });

    describe("Transfer", () => {
        it("should have 0.5MT", async () => {
            const amount = hre.ethers.parseUnits("0.5", decimals);

            // connect(signer0)을 명시적으로 사용하여 signer0이 호출함을 나타냄
            await expect(
                myTokenC.connect(signer0).transfer(amount, signer1.address)
            )
                .to.emit(myTokenC, "Transfer")
                .withArgs(
                    signer0.address,
                    signer1.address,
                    amount
                );
            
            // ▼▼▼ 불필요한 'expect(1).to.emit...' 중복 코드 제거됨 ▼▼▼

            expect(await myTokenC.balanceOf(signer1.address)).equal(amount);
        });

        it("should be reverted with insufficient balance error", async () => {
            const amount = hre.ethers.parseUnits((mintingAcount + 1n).toString(), decimals); // 101 MT
            
            // signer0이 101 MT를 signer1에게 전송 시도
            await expect(
                myTokenC.connect(signer0).transfer(amount, signer1.address)
            ).to.be.revertedWith("insufficient balance");
        });
    });

    describe("TransferFrom", () => {
        it("should emit Approval event", async () => {
            const amount = hre.ethers.parseUnits("10", decimals);

            // signer0이 signer1에게 10 MT를 승인
            await expect(
                myTokenC.connect(signer0).approve(signer1.address, amount)
            )
                .to.emit(myTokenC, "Approval")
                // 참고: Solidity 코드의 이벤트가 (spender, amount) 순서이므로
                // 테스트도 (signer1.address, amount) 순서로 검증합니다.
                .withArgs(signer1.address, amount);
        });

        it("should be revertes with insufficient allowance error", async () => {
            // beforeEach 덕분에 이 테스트는 allowance가 0인 깨끗한 상태로 시작
            
            await expect(
                myTokenC
                    .connect(signer1) // signer1이
                    .transferFrom(
                        signer0.address, // signer0의 토큰을
                        signer1.address, // signer1 자신에게
                        hre.ethers.parseUnits("1", decimals) // 1 MT 만큼
                    )
            )
            // 'insufficient allowance'가 아닌, Solidity 코드의 'insufficient allownce' 오타와 정확히 일치해야 함
            .to.be.revertedWith("insufficient allownce");
        });

        // ▼▼▼ "transferFrom 성공" 케이스 테스트 추가 ▼▼▼
        it("should succeed transferFrom with sufficient allowance", async () => {
            const amountToApprove = hre.ethers.parseUnits("10", decimals);
            const amountToTransfer = hre.ethers.parseUnits("5", decimals);
            const initialBalance = mintingAcount * 10n ** decimals;

            // 1. 준비: signer0이 signer1에게 10 MT 승인
            await myTokenC.connect(signer0).approve(signer1.address, amountToApprove);

            // 2. 실행: signer1이 signer0의 5 MT를 자신에게 전송
            await expect(
                myTokenC.connect(signer1).transferFrom(
                    signer0.address,
                    signer1.address,
                    amountToTransfer
                )
            ).to.not.be.reverted; // 실패(revert)하지 않아야 함

            // 3. 검증: 잔액 확인
            expect(await myTokenC.balanceOf(signer1.address)).to.equal(amountToTransfer);
            expect(await myTokenC.balanceOf(signer0.address)).to.equal(
                initialBalance - amountToTransfer
            );
        });
    });
});