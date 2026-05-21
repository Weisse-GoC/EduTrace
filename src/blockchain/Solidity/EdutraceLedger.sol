// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EdutraceLedger {
    address public owner;

    // The ledger: Maps the file's Keccak256 hash to a boolean
    mapping(bytes32 => bool) private verifiedDocuments;

    struct DocumentRecord {
        address issuer;
        string ipfsCid;
        uint256 timestamp;
    }

    mapping(bytes32 => DocumentRecord) public registry;

    event DocumentMinted(bytes32 indexed fileHash, string ipfsCid);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * Matches your Edge Function: contract.issueCredential(recipient, cid)
     * It generates the hash internally using the same logic as your frontend.
     */
    function issueCredential(address recipient, string memory cid) public onlyOwner returns (bytes32) {
        // We create a unique hash for this specific issuance
        bytes32 fileHash = keccak256(abi.encodePacked(recipient, cid));
        
        verifiedDocuments[fileHash] = true;
        registry[fileHash] = DocumentRecord({
            issuer: msg.sender,
            ipfsCid: cid,
            timestamp: block.timestamp
        });

        emit DocumentMinted(fileHash, cid);
        return fileHash;
    }

    /**
     * Matches your StudentDashboard: verifyDocument(hash)
     */
    function verifyDocument(bytes32 _fileHash) public view returns (bool) {
        return verifiedDocuments[_fileHash];
    }
}