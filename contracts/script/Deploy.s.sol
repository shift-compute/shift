// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ShiftLedger} from "../src/ShiftLedger.sol";

/// forge script script/Deploy.s.sol --rpc-url zg_mainnet --broadcast --private-key $OPERATOR_PRIVATE_KEY
/// (añadir --legacy si la red rechaza transacciones EIP-1559)
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        ShiftLedger ledger = new ShiftLedger(msg.sender);
        vm.stopBroadcast();
        console.log("ShiftLedger:", address(ledger));
        console.log("Operator/owner:", msg.sender);
    }
}
