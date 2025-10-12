// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MyToken {

    string public name;
    string public symbol;
    uint8 public decimals; // uint8 --> 8bit unsigned int, uint16, ... , uint256

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimal
        // uint256 _amount
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimal;
        // The amount is multiplied by 10 to the power of decimals
        // to create the correct total supply based on the token's decimal places.
        // _mint(_amount * 10 ** uint256(decimals), msg.sender);
    }
}
