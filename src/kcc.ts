export class KccCredential {
  countryOfResidence: string;
  tier?: string;
  jurisdiction?: { country: string };
  credentialSchema: any;
  evidence: Array<{ kind: string; checks: string[] }>;

  constructor(
    countryOfResidence: string,
    tier: string | null = null,
    jurisdiction: { country: string } | null = null,
    credentialSchema: any,
    evidence: Array<{ kind: string; checks: string[] }> = [],
  ) {
    this.countryOfResidence = countryOfResidence;
    this.tier = tier || undefined; // Optional tier
    this.jurisdiction = jurisdiction || undefined; // Optional jurisdiction object
    this.credentialSchema = credentialSchema;

    this.evidence = evidence;
  }
}
