# Known Customer Credential (KCC) Issuer Service

This service provides an implementation of the **tbDEX Web5 SDK** to issue a **Known Customer Credential (KCC)** to customers. The KCC is used to streamline the KYC process across different payment apps, allowing businesses to recognize repeat customers without requiring redundant verification.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Setup](#setup)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Web5 Connection](#web5-connection)
- [KCC Issuing Flow](#kcc-issuing-flow)
- [DWN Interaction](#dwn-interaction)
- [Resources](#resources)

## Introduction

This project showcases how to issue a **Known Customer Credential (KCC)** using the **Web5 SDK** in compliance with tbDEX's open messaging protocol. The service creates a Decentralized Identifier (DID) and Decentralized Web Node (DWN) for issuing a Verifiable Credential (VC) to customers who have already completed KYC verification. The VC JWT is stored in the customer's DWN, which they can later present from any payment application.

## Features

- **Decentralized Identifier (DID) Creation**: Automatically creates DIDs and DWNs for both the issuer and customers.
- **Known Customer Credential Issuance**: Issues a Verifiable Credential (VC) JWT that represents the customer's verified identity.
- **Protocol Installation**: Installs the VC protocol in the issuer's DWN to handle communication between different payment applications.
- **Permission Management**: Obtains the necessary permissions to write records to a customer's DWN using the tbDEX Web5 SDK.
- **DWN Record Management**: Writes the VC JWT to the customer's DWN and fetches records when required.

## Setup

### Prerequisites

- Node.js (v16.x or higher)
- NPM or Yarn
- [Web5 SDK](https://github.com/TBD54566975/web5-js)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/Johnnyevans32/kcc-hackathon.git
    cd kcc-hackathon
    ```

2. Install the required dependencies:

    ```bash
    npm install
    ```

3. Set up your `.env` file with the following variables:

    ```bash
    WEB5_DWN_ENDPOINT=https://dwn.gcda.xyz
    ```

## Usage

### Running the Service

Start the service:

```bash
npm run start
```

## API Endpoints

### 1. Issue KCC Credential

- **URL**: `/kcc/issue`
- **Method**: `GET`
- **Description**: Issues a Known Customer Credential (KCC) for the specified customer DID.
- **Query Parameters**:
  - `subjectDid` (optional): The DID of the customer. Defaults to Alice's DID.
- **Response**: Returns the Record ID of the stored KCC in the customer's DWN.

Example response:

```json
{
  "data":{
    "recordId": "b6a1d2e1-e134-45b2-8d57-48f7cbbe2b64"
  }
}
```

## 2. Fetch KCC Records

- **URL**: `/kcc`
- **Method**: `GET`
- **Description**: Fetches the existing KCC records for the specified customer DID.
- **Query Parameters**:
  - `subjectDid`: The DID of the customer.
- **Response**: Returns a list of KCC records.

Example response:

```json
{
  "data": [
    {
      "recordId": "b6a1d2e1-e134-45b2-8d57-48f7cbbe2b64",
      "data": "<VC JWT Data>"
    }
  ]
}
```

## Web5 Connection

The service uses the Web5 SDK to connect to the Web5 platform, creating a DID and DWN. This connection is initialized when the service starts and stores DID information for use in issuing and managing KCC credentials.

To modify the Web5 connection or DID options, refer to the `getWeb5Connection` method in `AppService`:

```typescript
async getWeb5Connection() {
  const { web5, did } = await Web5.connect({
    didCreateOptions: {
      dwnEndpoints: [process.env.WEB5_DWN_ENDPOINT],
    },
  });
  this.web5 = web5;
  this.issuerBearerDid = did;
}
```

## KCC Issuing Flow

1. **Create the KCC Credential**: The `KccCredential` class is used to create a credential with required data, including KYC evidence such as document verification and sanction screening.
2. **Sign the Credential**: The Verifiable Credential is signed using the issuer's Bearer DID.
3. **Protocol Installation**: The VC protocol is installed in the issuer's DWN for managing KCC issuance and storage.
4. **Store the Credential**: The signed VC JWT is written as a private record in the customer's DWN.

## DWN Interaction

The Decentralized Web Node (DWN) stores and retrieves the customer's Verifiable Credential (VC) JWT. The app interacts with Alice's DWN by:

- Requesting write permission using a GET request to the provided endpoint.
- Creating records for the VC JWT.
- Fetching stored records.

The write permission is obtained with the following request:

```typescript
await axios.get(
  `https://vc-to-dwn.tbddev.org/authorize?issuerDid=${this.issuerBearerDid.uri}`
);
```

## Resources

- [Web5 SDK Documentation](https://github.com/TBD54566975/web5-js)
- [tbDEX Protocol Documentation](https://developer.tbd.website/docs)
- [DID (Decentralized Identifier) Spec](https://www.w3.org/TR/did-core/)
- [Verifiable Credentials Spec](https://www.w3.org/TR/vc-data-model/)

