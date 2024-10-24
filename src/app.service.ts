import { BadRequestException, Injectable } from '@nestjs/common';
import { VerifiableCredential } from '@web5/credentials';
import axios from 'axios';
import { KccCredential } from './kcc';
import { Web5 } from '@web5/api';
import { VcProtocolDefinition } from './vc-protocol';
import { Web5PlatformAgent } from '@web5/agent';
import { BearerDid } from '@web5/dids';

@Injectable()
export class AppService {
  private aliceDid =
    'did:dht:rr1w5z9hdjtt76e6zmqmyyxc5cfnwjype6prz45m6z1qsbm8yjao';

  private web5: Web5;
  private issuerBearerDid: BearerDid;

  constructor() {}

  getHello(): string {
    return 'Hello World!';
  }

  async onModuleInit() {
    await this.setupWeb5Connection();
  }

  async issueKccCredential(_subjectDid?: string) {
    console.log('issuing kcc credentails');
    const subjectDid = _subjectDid || this.aliceDid;
    const kccCredentialInstance = new KccCredential(
      'US',
      'Gold',
      {
        country: 'US',
      },
      {
        id: 'https://vc.schemas.host/kcc.schema.json',
        type: 'JsonSchema',
      },
      [
        {
          kind: 'document_verification',
          checks: ['passport', 'utility_bill'],
        },
        {
          kind: 'sanction_screening',
          checks: ['PEP'],
        },
      ],
    );

    const vc = await VerifiableCredential.create({
      issuer: this.issuerBearerDid.uri,
      subject: subjectDid,
      expirationDate: '2026-05-19T08:02:04Z',
      data: {
        countryOfResidence: kccCredentialInstance.countryOfResidence,
        tier: kccCredentialInstance.tier,
        jurisdiction: kccCredentialInstance.jurisdiction,
      },
      credentialSchema: kccCredentialInstance.credentialSchema,
      evidence: kccCredentialInstance.evidence,
    });
    const vcJwt = await vc.sign({ did: this.issuerBearerDid });

    await this.installVcProtocol();
    await this.obtainDWNWritePermission();
    await this.createRole('issuer');
    const recordId = await this.createVcJwtRecord(vcJwt, subjectDid);

    return { recordId };
  }

  async fetchVcJwtRecords(subjectDid: string) {
    console.log('fetching vc jwt records from subject');
    const { records, status } = await this.web5.dwn.records.query({
      from: subjectDid,
      message: {
        filter: {
          dataFormat: 'application/vc+jwt',
          protocol: VcProtocolDefinition.protocol,
          protocolPath: 'credential',
          schema: VcProtocolDefinition.types.credential.schema,
        },
      },
    });

    if (status.code !== 200) {
      throw new BadRequestException(status.detail);
    }
    const loadedRecords = await Promise.all(
      (records || []).map(
        async (record: { data: { text: () => any }; id: any }) => {
          const data = await record.data.text();
          return { recordId: record.id, data };
        },
      ),
    );

    return loadedRecords;
  }

  async createVcJwtRecord(signedVcJwt: string, subjectDid: string) {
    console.log('creating vc jwt record for subject');

    const { record, status } = await this.web5.dwn.records.create({
      data: signedVcJwt,
      message: {
        dataFormat: 'application/vc+jwt',
        protocol: VcProtocolDefinition.protocol,
        protocolPath: 'credential',
        protocolRole: 'issuer',
        schema: VcProtocolDefinition.types.credential.schema,
        recipient: subjectDid,
      },
    });
    if (status.code !== 202) {
      throw new BadRequestException(status.detail);
    }

    const { status: sendStatus } = await record.send(subjectDid);
    if (sendStatus.code !== 202) {
      throw new BadRequestException(sendStatus.detail);
    }

    return record.id;
  }

  async createRole(role: 'issuer' | 'judge') {
    console.log(`creating ${role} role for issuer did`);
    const { record, status } = await this.web5.dwn.records.create({
      message: {
        dataFormat: 'text/plain',
        protocol: VcProtocolDefinition.protocol,
        protocolPath: role,
        schema: VcProtocolDefinition.types[role].schema,
        recipient: this.issuerBearerDid.uri,
      },
      data: undefined,
    });

    if (
      status.code === 400 &&
      status.detail.includes('ProtocolAuthorizationDuplicateRoleRecipient')
    ) {
      console.log(`${role} role already granted to did`);
      return;
    }
    const { status: sendStatus } = await record.send(this.issuerBearerDid.uri);
    if (sendStatus.code !== 202) {
      throw new BadRequestException(sendStatus.detail);
    }
  }

  async installVcProtocol() {
    console.log('installing vc protocol');
    const { protocol, status } = await this.web5.dwn.protocols.configure({
      message: {
        definition: VcProtocolDefinition,
      },
    });
    if (status.code !== 202) {
      throw new BadRequestException(status.detail);
    }

    const { status: sendStatus } = await protocol.send(
      this.issuerBearerDid.uri,
    );
    if (sendStatus.code !== 202) {
      throw new BadRequestException(sendStatus.detail);
    }
  }

  async setupWeb5Connection() {
    console.log('connecting to web5');
    const { web5, did } = await Web5.connect({
      didCreateOptions: {
        dwnEndpoints: ['https://dwn.gcda.xyz'],
      },
      registration: {
        onSuccess: () => {},
        onFailure: (error) => {},
      },
    });

    const { did: issuerBearerDid } = await (
      web5.agent as Web5PlatformAgent
    ).identity.get({
      didUri: did,
    });

    this.web5 = web5;
    this.issuerBearerDid = issuerBearerDid;

    return { issuerBearerDid };
  }

  private async obtainDWNWritePermission() {
    console.log('obtaining dwn write permission for issuer');
    await axios.get(
      `https://vc-to-dwn.tbddev.org/authorize?issuerDid=${this.issuerBearerDid.uri}`,
    );
  }
}
