# CDMS (Consortium-based Criminal Data Management System) - Backend

This document provides instructions for setting up and running the NestJS backend for the CDMS project.

This backend service provides REST APIs that interact with a Hyperledger Fabric blockchain for on-chain data and MinIO for off-chain encrypted file storage. The system is designed to connect law enforcement (Org1) and non - police (Org2) organizations.

> **Note:** All project code is located in the `v2` branch.

## Prerequisites

Before starting the backend, verify that the following external services are running and accessible:

* **Hyperledger Fabric:** The blockchain network must be running.
* **Vault:** The Vault server must be running and setup for transit (e.g., `http://localhost:8200`).
* **MinIO:** The MinIO server must be running and setup for storing (e.g., `http://localhost:9001`).

## Setup and Configuration

### 1. Chaincode (Smart Contract)

**Important:** The chaincode (e.g., `cdms.go`) is **not** part of this backend. It must be deployed and instantiated on your Hyperledger Fabric network *before* starting the backend.

### 2. Environment Variables

Create a `.env` file in the root of the backend project with the following content:
```dotenv
# --- MinIO Configuration ---
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=<admin>
MINIO_SECRET_KEY=<password>
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=<cdms-records>

# --- Vault Configuration ---
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=<token>

# --- Application Configuration ---
PORT=3000
```

### 3. Fabric Configuration

The backend requires connection profiles and admin certificates to communicate with the Fabric network.

1. Create a folder in the backend root named: `fabric-config`
2. Copy and rename the required files from your `fabric-samples` test network directory into this `fabric-config` folder.

| Source Path (from fabric-samples) | Destination (in fabric-config) | Rename To |
|---|---|---|
| `test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk` | `fabric-config/` | `key.pem` |
| `test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem` | `fabric-config/` | `Admin@org1.example.com-cert.pem` |
| `test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt` | `fabric-config/` | `tls-root-cert.pem` |
| `test-network/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp/keystore/priv_sk` | `fabric-config/` | `key-org2.pem` |
| `test-network/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp/signcerts/Admin@org2.example.com-cert.pem` | `fabric-config/` | `Admin@org2.example.com-cert.pem` |
| `test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt` | `fabric-config/` | `tls-root-cert-org2.pem` |

### 4. Install Dependencies

Install the required Node.js packages.
```bash
npm install
```

## Running the Application

Start the NestJS server in development mode.
```bash
npm run start:dev
```

The backend will be running at:

👉 **http://localhost:3000**