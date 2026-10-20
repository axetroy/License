# Usage guide

## Install

```sh
npm install license-xml
```

The package supports Node.js 18 and newer.

## JavaScript API

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const payload = {
  licenseId: 'LIC-001',
  product: { id: 'my-product', version: '5' },
  type: 'perpetual',
  customer: { id: 'customer-1', name: 'Example Customer' },
  validity: { issuedAt: '2026-10-20T12:00:00Z' },
  features: [{ id: 'export', enabled: true }],
  limits: [],
  machine: { type: 'none' },
};

const xml = issueLicense(payload, { keyId: 'production-2026', privateKey });
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});
console.log(result.status);
```

Keep `privateKey` only on the issuing system. Production verifiers should use the embedded/configured trusted public key rather than generate a key pair at runtime. `verifyLicense` returns a status and includes the parsed license only when valid. Pass `now` as a `Date` or timestamp for deterministic time checks.

## CLI

Generate issuer keys:

```sh
npx license-xml keygen --private private.pem --public public.pem
```

Issue and verify a license:

```sh
npx license-xml issue --payload payload.json --private private.pem --key-id production-2026 --out product.license.xml
npx license-xml verify --file product.license.xml --key-id production-2026 --public-key public.pem --product-id my-product --product-version 5
```

The CLI refuses to overwrite files. Protect private key files and backups with operating-system access controls. Verification exits with status `1` for an invalid license and `2` for command or input errors.

## Try it

Open the [browser playground](./playground) to create and verify a demo license locally. Its temporary key is for demonstration only and must never be used for production issuance.
