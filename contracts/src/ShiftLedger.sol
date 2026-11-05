// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShiftLedger
/// @notice Anchors Shift nightly batches (attribution + curation) and records compute donations.
/// @dev 0G already settles a proof per model interaction. This contract adds WHO each result belongs to,
/// WHO donated compute to the commons, and WHICH commons results passed the quality gate.
/// Leaves follow OpenZeppelin StandardMerkleTree encoding:
/// leaf = keccak256(bytes.concat(keccak256(abi.encode(
///   bytes32 requestIdHash, address owner, bytes32 taskIdHash, bytes32 outputRoot,
///   bytes32 modelHash, uint8 trustTier, uint64 costUsdMicro, bool isCommons))))
contract ShiftLedger is Ownable {
    struct Night {
        bytes32 root;
        bytes32 manifestRoot;
        uint32 itemCount;
        uint64 anchoredAt;
        bool donationsRecorded;
    }

    /// @dev nightId: YYYYMMDD for scheduled nights, unix seconds for manual runs.
    mapping(uint64 => Night) public nights;
    mapping(uint64 => mapping(address => uint64)) public donatedUsdMicro;
    mapping(address => uint64) public totalDonatedUsdMicro;

    event NightAnchored(uint64 indexed nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount);
    event DonationRecorded(uint64 indexed nightId, address indexed donor, uint64 amountUsdMicro);

    error AlreadyAnchored(uint64 nightId);
    error NotAnchored(uint64 nightId);
    error DonationsAlreadyRecorded(uint64 nightId);
    error LengthMismatch();
    error EmptyRoot();

    constructor(address operator) Ownable(operator) {}

    function anchorNight(uint64 nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount) external onlyOwner {
        if (root == bytes32(0)) revert EmptyRoot();
        if (nights[nightId].anchoredAt != 0) revert AlreadyAnchored(nightId);
        nights[nightId] = Night(root, manifestRoot, itemCount, uint64(block.timestamp), false);
        emit NightAnchored(nightId, root, manifestRoot, itemCount);
    }

    function recordDonations(uint64 nightId, address[] calldata donors, uint64[] calldata amounts) external onlyOwner {
        Night storage n = nights[nightId];
        if (n.anchoredAt == 0) revert NotAnchored(nightId);
        if (n.donationsRecorded) revert DonationsAlreadyRecorded(nightId);
        if (donors.length != amounts.length) revert LengthMismatch();
        n.donationsRecorded = true;
        for (uint256 i = 0; i < donors.length; i++) {
            donatedUsdMicro[nightId][donors[i]] += amounts[i];
            totalDonatedUsdMicro[donors[i]] += amounts[i];
            emit DonationRecorded(nightId, donors[i], amounts[i]);
        }
    }

    /// @notice Verifies a precomputed leaf hash against the anchored root of `nightId`.
    function verifyLeaf(uint64 nightId, bytes32[] calldata proof, bytes32 leaf) external view returns (bool) {
        bytes32 root = nights[nightId].root;
        if (root == bytes32(0)) return false;
        return MerkleProof.verify(proof, root, leaf);
    }

    /// @notice Computes the leaf hash on-chain from its values (used by tests and optional verifiers).
    function leafHash(
        bytes32 requestIdHash,
        address owner_,
        bytes32 taskIdHash,
        bytes32 outputRoot,
        bytes32 modelHash,
        uint8 trustTier,
        uint64 costUsdMicro,
        bool isCommons
    ) public pure returns (bytes32) {
        return keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(requestIdHash, owner_, taskIdHash, outputRoot, modelHash, trustTier, costUsdMicro, isCommons)
                )
            )
        );
    }
}
