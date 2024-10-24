import { BadRequestException, Injectable } from '@nestjs/common';
import { Jwt } from '@web5/credentials';
import { randomBytes } from 'crypto';
import { AppService } from './app.service';
import { PORT } from './main';

@Injectable()
export class IDVService {
  private idvResults = {};

  constructor(private appService: AppService) {}
  async siopV2AuthRequest() {
    const { issuerBearerDid } = await this.appService.setupWeb5Connection();
    // Construct the SIOPv2 Authorization Request
    const siopRequestPayload = {
      client_id: issuerBearerDid.uri, // Issuer's Decentralized Identifier string
      scope: 'openid', // Standard OpenID Connect scope
      response_type: 'id_token', // Expected response formats: ID Token and optionally, Verifiable Presentation Token
      response_uri: `http://localhost:${PORT}/siopv2/response`, // Endpoint for SIOP response delivery
      response_mode: 'direct_post', // Delivery method of the SIOP response
      nonce: randomBytes(16).toString('hex'), // Unique string to link the request and response
      client_metadata: {
        // Descriptive metadata about the requesting party (Issuer)
        subject_syntax_types_supported: 'did:dht did:jwk did:web',
      },
    };
    // Sign the SIOPv2 Auth Request
    const siopRequestJwtPayload = {
      sub: issuerBearerDid.uri, // Issuer's Decentralized Identifier string
      iss: issuerBearerDid.uri, // Issuer's Decentralized Identifier string
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + 86400, // Expiration time
      request: siopRequestPayload, // Embed the SIOPv2 Auth request payload
    };

    const jwtToken = await Jwt.sign({
      signerDid: issuerBearerDid,
      payload: siopRequestJwtPayload,
    });
    // Send the SIOPv2 Auth Request in JAR format
    const queryString = `client_id=${encodeURIComponent(
      issuerBearerDid.uri,
    )}&request=${encodeURIComponent(jwtToken)}`;
    return queryString;
  }

  async siopV2AuthResponse(walletResponse: any) {
    const compactIdToken = walletResponse.id_token;
    if (!compactIdToken) {
      throw new BadRequestException('Missing ID Token');
    }

    const idTokenVerificationResult = await Jwt.verify({ jwt: compactIdToken });
    if (!idTokenVerificationResult.payload.nonce) {
      throw new BadRequestException('Nonce invalid');
    }

    const credentialOffer = {
      credential_issuer: `http://localhost:${PORT}`,
      credential_configuration_ids: ['KnownCustomerCredential'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': randomBytes(16).toString('hex'),
        },
      },
    };

    this.idvResults[idTokenVerificationResult.payload.iss] = 'idv-pending';

    const idvRequest = {
      credential_offer: credentialOffer,
      url: 'http://localhost:3002/idv-form', // the url for the idv-vendor/ project
    };

    return idvRequest;
  }

  async idvSubmmision(payload: any) {
    const { applicantDid } = payload;
    this.idvResults[applicantDid] = 'idv-completed';
  }

  async getCredentialIssuerMetadata() {
    const credentialIssuerMetadata = {
      credential_issuer: `http://localhost:${PORT}`,
      credential_endpoint: `http://localhost:${PORT}/oid4vci/credential`,
      credential_configurations_supported: {
        format: 'jwt_vc_json',
        cryptographic_binding_methods_supported: [
          'did:web',
          'did:jwk',
          'did:dht',
        ],
        credential_signing_alg_values_supported: ['EdDSA', 'ES256K'],
        proof_types_supported: {
          jwt: { proof_signing_alg_values_supported: ['EdDSA', 'ES256K'] },
        },
      },
    };

    return credentialIssuerMetadata;
  }

  async getAuthServerMetadata() {
    const authorizationServerMetadata = {
      issuer: `http://localhost:${PORT}`,
      token_endpoint: `http://localhost:${PORT}/oid4vci/token`,
    };

    return authorizationServerMetadata;
  }

  async getAccessToken(payload: any) {
    const { grant_type, client_id } = payload;
    if (grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      throw new BadRequestException(
        'The authorization grant type is not supported by the authorization server',
      );
    }

    // todo verify pre-auth code
    // todo it should be validated against the provided client_id
    if (payload['pre-authorized_code'] === '') {
      throw new BadRequestException('The provided pre-auth code is invalid');
    }

    if (this.idvResults[client_id] === 'idv-pending') {
      throw new BadRequestException(
        'Still waiting to hear back from the IDV submission',
      );
    }

    const { issuerBearerDid } = await this.appService.setupWeb5Connection();
    const exp = Math.floor(Date.now() / 1000) + 30 * 60; // plus 30 minutes
    const claims = {
      iss: issuerBearerDid.uri,
      sub: client_id,
      iat: Math.floor(Date.now() / 1000),
      exp,
    };
    // TODO the JWT typ header will not be properly set
    const accessTokenJwt = await Jwt.sign({
      signerDid: issuerBearerDid,
      payload: claims,
    });

    return {
      access_token: accessTokenJwt,
      token_type: 'bearer',
      expires_in: exp,
      c_nonce: randomBytes(16).toString('hex'),
      c_nonce_expires_in: 30 * 60, // 30 minutes
    };
  }

  async getCredential(headers: any, payload: any) {
    try {
      const accessToken = headers['authorization'].split(' ')[1];
      await Jwt.verify({ jwt: accessToken });
    } catch {
      throw new BadRequestException('access token verification failed');
    }

    let customersDidUri;
    const { proof } = payload;
    try {
      const { payload } = await Jwt.verify({ jwt: proof.jwt });
      customersDidUri = payload.iss;
      if (!payload.nonce) {
        throw new BadRequestException('Nonce invalid');
      }
    } catch (e) {
      throw new BadRequestException('Proof jwt verification failed');
    }

    const vcJwt = await this.appService.issueKccCredential(customersDidUri);
    return { credential: vcJwt };
  }
}
