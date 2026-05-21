# EduTrace - Blockchain-Based Educational Credential System

EduTrace is a comprehensive web application for issuing, managing, and verifying digital educational credentials using blockchain technology. The system provides secure, tamper-proof certificates that can be instantly verified by third parties.

## Features

- **Multi-Role Platform**: Support for students, staff, heads (administrators), and public verifiers
- **Blockchain Integration**: Credentials are anchored to Arbitrum blockchain for immutability
- **IPFS Storage**: Secure decentralized storage for credential documents
- **QR Code Verification**: Easy credential sharing and verification
- **Role-Based Access Control**: Secure access management for different user types
- **Real-time Dashboard**: Live monitoring of credential issuance process

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Router
- **Backend**: Supabase (database + edge functions)
- **Blockchain**: Ethereum/Arbitrum L2, ethers.js
- **Storage**: IPFS via Pinata
- **Authentication**: Supabase Auth with role-based permissions

## Prerequisites

- Node.js 18+
- Supabase account
- Pinata account (for IPFS)
- Ethereum wallet with testnet ETH (for blockchain interactions)
- Infura/Alchemy API key (for Arbitrum RPC)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd edutrace
npm install
```

### 2. Environment Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Fill in the following variables in your `.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Blockchain Configuration
VITE_CONTRACT_ADDRESS=0x995693F2CeD76AC7e24D453380C03294Af3900D0
VITE_ARBITRUM_RPC=https://arbitrum-sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_ARB_EXPLORER_URL=https://sepolia.arbiscan.io/tx/

# IPFS/Pinata Configuration
VITE_PINATA_KEY=your_pinata_api_key
VITE_PINATA_SECRET=your_pinata_secret_key
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run the database migrations:
   ```bash
   supabase db push
   ```
3. Set environment variables in Supabase Edge Functions:
   - `ARBITRUM_RPC_URL`: Your Arbitrum RPC URL
   - `BLOCKCHAIN_PRIVATE_KEY`: Private key for credential minting (use a dedicated wallet)
   - `PINATA_JWT`: Your Pinata JWT token

### 4. Deploy Edge Functions

```bash
supabase functions deploy ipfs-upload
supabase functions deploy mint-credential
```

### 5. Smart Contract Deployment

The system uses a pre-deployed credential contract on Arbitrum Sepolia. For production, you would need to:

1. Deploy the credential contract to your desired network
2. Update the `VITE_CONTRACT_ADDRESS` in your environment
3. Ensure the contract ABI matches the expected interface

### 6. Run the Application

```bash
npm run dev
```

## User Roles & Workflows

### Students
- Register and create profile
- Submit credential applications
- View issued credentials
- Share credentials via QR codes

### Staff
- Review and verify student applications
- Approve/reject credential requests
- View credentials within their school

### Heads (Administrators)
- Mint approved credentials on blockchain
- Monitor issuance statistics
- Manage system-wide operations

### Public Verifiers
- Scan QR codes to verify credentials
- View credential details and blockchain proof

## Database Schema

The system uses the following main tables:
- `profiles`: User profiles with roles
- `student_records`: Student information
- `student_applications`: Credential requests
- `credentials`: Issued blockchain credentials

## API Endpoints

### Supabase Edge Functions
- `ipfs-upload`: Upload documents to IPFS
- `mint-credential`: Mint credentials on blockchain

### Smart Contract Functions
- `issueDocument(bytes32 _fileHash, string _metadata)`: Issue new credential
- `verifyDocument(bytes32 _fileHash)`: Verify credential existence
- `getDocumentDetails(bytes32 _fileHash)`: Get credential metadata

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Security Considerations

- All credentials are immutably stored on blockchain
- IPFS provides decentralized, permanent storage
- Row Level Security (RLS) protects data access
- Private keys are stored securely in Supabase environment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
