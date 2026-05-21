import { ethers } from "ethers";

// 1. Validated contract address matching your Arbiscan receipt
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS; 

export const CONTRACT_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "recipient", "type": "address" },
            { "internalType": "string", "name": "cid", "type": "string" }
        ],
        "name": "issueCredential",
        "outputs": [
            { "internalType": "bytes32", "name": "", "type": "bytes32" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "_fileHash", "type": "bytes32" }
        ],
        "name": "verifyDocument",
        "outputs": [
            { "internalType": "bool", "name": "", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "", "type": "bytes32" }
        ],
        "name": "registry",
        "outputs": [
            { "internalType": "address", "name": "issuer", "type": "address" },
            { "internalType": "string", "name": "ipfsCid", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export const getReadOnlyProvider = () => {
    // Falls back to your local environment file definition if available
    return new ethers.JsonRpcProvider(import.meta.env.VITE_ARBITRUM_RPC);
};

export const getReadOnlyContract = () => {
    const provider = getReadOnlyProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};