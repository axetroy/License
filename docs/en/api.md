---
sidebar: false
---

# API reference

The `license-xml` package exposes functions for generating Ed25519 keys, issuing licenses, parsing license XML, and verifying licenses.

```js
import {
  LicenseStatus,
  generateKeyPair,
  issueLicense,
  parseLicense,
  verifyLicense,
} from 'license-xml';
```

## `generateKeyPair()`

Returns an Ed25519 key pair as PEM-encoded strings:

```js
{
  privateKey: string, // PKCS#8 PEM; keep secret
  publicKey: string,  // SPKI PEM; distribute to verifiers
}
```

Call this in a controlled key-management or issuance environment. Do not generate keys in a client application as a substitute for configuring the issuer's trusted public key.

## `issueLicense(payload, options)`

Validates a license payload, signs its canonical XML using Ed25519, and returns the complete license XML string.

```js
const xml = issueLicense(payload, {
  keyId: 'production-2026',
  privateKey,
});
```

`options` requires:

| Option | Type | Description |
| --- | --- | --- |
| `keyId` | `string` | 1–128 letters, digits, dots, underscores, or hyphens; identifies the signing key. |
| `privateKey` | `string \| Buffer` | Ed25519 private key in PEM format. |

The payload fields and validation rules are defined in the [protocol specification](./specification). Invalid options or payloads throw an `Error`. The resulting XML is limited to 1 MiB.

## `parseLicense(xml)`

Parses and validates license XML without verifying its signature:

```js
const parsed = parseLicense(xml);
// { payload, algorithm, keyId, signature, canonicalPayload }
```

`signature` is a `Buffer`; the remaining values are strings or parsed payload data. Invalid or unsupported XML structure throws an `Error`. Parsing alone does **not** establish that the license is authentic; use `verifyLicense` before trusting its claims.

## `verifyLicense(xml, options?)`

Checks the license format and signature, then applies the optional product, time, and machine checks. It returns a result object rather than throwing for invalid license content:

```js
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKeyPem]]),
  productId: 'my-product',
  productVersion: '5',
});

if (result.status === LicenseStatus.VALID) {
  console.log(result.license);
}
```

| Option | Type | Description |
| --- | --- | --- |
| `publicKeys` | `Map<string, string \| Buffer> \| object` | Trusted public keys indexed by `keyId`. Required for a known signing key. |
| `productId` | `string` | If provided, require an exact product ID match. |
| `productVersion` | `string \| number` | If provided, require an exact version match. |
| `now` | `Date \| number \| string` | Verification time; defaults to the current time. |
| `machineFingerprint` | `string` | Current 64-character hexadecimal SHA-256 fingerprint for a fingerprint-bound license. |

The result is `{ status }` for any non-`VALID` outcome, and `{ status: 'VALID', license }` on success. Use the license data only after checking for `VALID`; the application remains responsible for enforcing features and limits.

## `LicenseStatus`

`LicenseStatus` is a frozen object containing the possible `status` values:

| Value | Meaning |
| --- | --- |
| `VALID` | Format, signature, and requested checks passed. |
| `INVALID_FORMAT` | XML, payload, signature encoding, or verification time is invalid. |
| `INVALID_SIGNATURE` | Signature is invalid, algorithm is unsupported, or the matching trusted key is unavailable. |
| `PRODUCT_MISMATCH` | A provided product ID or version does not match. |
| `NOT_YET_VALID` | The current verification time is before `issuedAt`. |
| `EXPIRED` | The current verification time is at or after `expiresAt`. |
| `MACHINE_MISMATCH` | Required machine fingerprint is absent, malformed, or does not match. |

Related: [Usage guide](./guide) for end-to-end examples and [How it works](./how-it-works) for the signing and verification flow.
