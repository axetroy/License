# Usage guide

This guide walks through installing `license-xml`, creating keys, issuing a license, and verifying it in an application. See the [protocol specification](./specification) for the complete field definitions and constraints.

## Install

```sh
npm install license-xml
```

The package requires Node.js 18 or newer. It is an ESM package; import it from `.mjs` files or projects with `"type": "module"`.

## Quick start: JavaScript API

This example issues a one-year subscription license and verifies its signature, product, and validity locally:

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const now = Date.now();
const issuedAt = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .replace(/\.\d{3}Z$/, 'Z');

const payload = {
  licenseId: 'LIC-001',
  product: { id: 'my-product', version: '5' },
  type: 'subscription',
  customer: { id: 'customer-1', name: 'Example Customer' },
  validity: { issuedAt, expiresAt },
  features: [{ id: 'export', enabled: true }],
  limits: [{ id: 'users', value: '50' }],
  machine: { type: 'none' },
};

const xml = issueLicense(payload, {
  keyId: 'production-2026',
  privateKey,
});

const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});

if (result.status === 'VALID') {
  console.log('License ID:', result.license.licenseId);
} else {
  console.error('License rejected:', result.status);
}
```

For demonstration, this example generates and uses the keys in the same process. In production, the issuing system must securely hold the private key; clients should be configured with trusted public keys only. Do not generate a new key pair at application startup or during verification, or the client will not be able to verify licenses issued with the established signing key.

### Payload fields

- `licenseId` is a license ID of 1–128 UTF-8 bytes.
- `product.id` and `product.version` identify the product and major version the license applies to.
- `type` is `trial`, `subscription`, or `perpetual`. The first two require an `expiresAt` later than `issuedAt`; perpetual licenses must omit it.
- `customer.id`, `customer.name`, and `validity.issuedAt` are required. Timestamps use UTC `YYYY-MM-DDTHH:mm:ssZ` form.
- `features` and `limits` are arrays. IDs must be unique within each array. Limit values are non-negative integers; strings are recommended to avoid precision loss for large values.
- Use `{ type: 'none' }` for an unbound license. Fingerprint binding also requires a 64-character hexadecimal SHA-256 fingerprint. The integrating application supplies the fingerprint during verification; the library does not collect device information.

## Verify licenses in your application

The verifier selects a trusted public key using the `keyId` in the signature. Configure public keys in the production application and provide the product identifiers:

```js
import { verifyLicense } from 'license-xml';

const result = verifyLicense(licenseXml, {
  publicKeys: new Map([
    ['production-2026', production2026PublicKeyPem],
    ['production-2027', production2027PublicKeyPem],
  ]),
  productId: 'my-product',
  productVersion: '5',
  machineFingerprint: currentMachineFingerprint,
});
```

Pass `machineFingerprint` when needed; it is compared only for fingerprint-bound licenses. The result `status` can be `VALID`, `INVALID_FORMAT`, `INVALID_SIGNATURE`, `PRODUCT_MISMATCH`, `NOT_YET_VALID`, `EXPIRED`, or `MACHINE_MISMATCH`. The parsed `license` is included only for `VALID`. Check the status before using its feature and limit claims, then enforce the corresponding authorization in your application.

`verifyLicense` uses the current time by default. Pass `now` as a `Date` or timestamp for tests or a fixed verification time. Expiration is exclusive: verification returns `EXPIRED` when the current time is equal to `expiresAt`.

## Use the CLI

The CLI is useful for manual issuance and verification or for integration into an issuance workflow. Generate a key pair in a controlled environment:

```sh
npx license-xml keygen --private private.pem --public public.pem
```

The CLI creates the private key file with owner-only read/write permissions and refuses to overwrite existing files. Store the private key and backups securely; do not commit them to a repository or distribute them to clients.

Create `payload.json`:

```json
{
  "licenseId": "LIC-001",
  "product": { "id": "my-product", "version": "5" },
  "type": "perpetual",
  "customer": { "id": "customer-1", "name": "Example Customer" },
  "validity": { "issuedAt": "2020-01-01T00:00:00Z" },
  "features": [{ "id": "export", "enabled": true }],
  "limits": [{ "id": "users", "value": "50" }],
  "machine": { "type": "none" }
}
```

Issue and verify the license:

```sh
npx license-xml issue \
  --payload payload.json \
  --private private.pem \
  --key-id production-2026 \
  --out product.license.xml

npx license-xml verify \
  --file product.license.xml \
  --key-id production-2026 \
  --public-key public.pem \
  --product-id my-product \
  --product-version 5
```

Successful verification prints `VALID`. Product ID, product version, and machine fingerprint options can be omitted as needed; omitting product options skips those matching checks. The `verify` command exits with code `1` for an invalid license and `2` for command or input errors. The CLI verify command configures one `keyId` at a time; to trust multiple rotated keys together, pass a `Map` with multiple entries to the JavaScript API.

## Security and deployment

- Use the private key only for issuance. Never place it in a browser, client application, frontend build output, or a server directory accessible to users.
- Treat `keyId` as an identifier, not a secret. For rotation, deploy the new public key to verifiers before issuing with its `keyId`; keep old public keys available as long as licenses signed by them are accepted.
- Make license verification part of your application's authorization flow. A valid signature does not itself enforce feature flags or usage limits.
- This format and library provide offline verification; they do not provide revocation, online activation, or hardware fingerprint collection.
- To try the workflow in a browser, open the [online Playground](./playground). Its temporary key is for demonstration only.
