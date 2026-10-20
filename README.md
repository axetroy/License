# License XML

[简体中文](./README.zh-CN.md) | [English](./README.md)

Node.js implementation of the License XML v1.0 offline license format. The format and its security boundaries are specified in [DESIGN.md](./DESIGN.md).

## Requirements

- Node.js 18 or newer
- npm
- Node.js 20.19 or newer to run the ESLint 10 development tooling

## Install and test

```sh
npm install
npm run check
```

## Create keys and issue a license

Generate an Ed25519 key pair. Keep the private key on the issuing system; distribute only the public key to verifiers.

```sh
node ./src/cli.js keygen --private private.pem --public public.pem
```

Create a UTF-8 JSON payload:

```json
{
  "licenseId": "LIC-20260924-00123",
  "product": { "id": "my-product", "version": "5" },
  "type": "subscription",
  "customer": { "id": "CUSTOMER-001", "name": "Acme Corporation" },
  "validity": {
    "issuedAt": "2026-09-24T08:00:00Z",
    "expiresAt": "2027-09-24T08:00:00Z"
  },
  "features": [{ "id": "export", "enabled": true }],
  "limits": [{ "id": "users", "value": "50" }],
  "machine": { "type": "none" }
}
```

Issue the XML license. Existing output files are never overwritten.

```sh
node ./src/cli.js issue \
  --payload payload.json \
  --private private.pem \
  --key-id production-2026 \
  --out my-product.license.xml
```

## Verify a license

```sh
node ./src/cli.js verify \
  --file my-product.license.xml \
  --key-id production-2026 \
  --public-key public.pem \
  --product-id my-product \
  --product-version 5
```

The verifier prints one of the statuses documented in `DESIGN.md`; it exits with status 1 when verification fails and status 2 for command or input errors. For machine-bound licenses, pass `--machine-fingerprint` with the application's expected 64-character SHA-256 digest.

The JavaScript API is also available:

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const xml = issueLicense(payload, { keyId: 'production-2026', privateKey });
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});
```

`issueLicense(payload, { keyId, privateKey })` creates a signed XML string. `verifyLicense(xml, options)` returns `{ status, license? }`. Pass `now` as a `Date` or timestamp for deterministic time checks. The verifier rejects DTD/entity declarations, XML namespaces, unknown elements, duplicate identifiers, malformed signatures, and licenses larger than 1 MiB.

## Scope and security notes

- Signing and verification use Node.js's built-in Ed25519 cryptography and Canonical XML 1.0 without comments.
- The package does not store private keys, run a license server, perform online revocation checks, collect hardware identifiers, or enforce application feature/usage policy.
- Machine fingerprint collection and revocation are application-layer integrations; offline verification cannot determine whether a license was revoked remotely.
- A valid signature proves that the signed payload was issued by a holder of the corresponding private key. It does not prevent patching the client application or changing the system clock.

## Browser playground

The browser playground at `https://axetroy.github.io/License/` lets you edit a payload, sign it with a temporary in-memory Ed25519 key, and verify or tamper with the resulting XML. It performs all license operations locally and does not send the entered license or keys to a server. The demo private key is not persisted and must never be used to issue production licenses.

The Pages workflow builds and deploys the static app on pushes to `main` or `master`. Enable **Settings → Pages → Build and deployment → GitHub Actions** once in the repository to activate deployments. Run `npm run build:playground` locally to create the static site in `dist/`.

## Automated npm publishing

The `Publish to npm` GitHub Actions workflow publishes a GitHub Release to npm using npm trusted publishing (OIDC), without an npm access token. Before the first release, configure the package's **Trusted Publisher** on npmjs.com to use this GitHub repository and `.github/workflows/publish.yml`. No `NPM_TOKEN` secret is needed.

To publish, update `package.json` and `package-lock.json` to the release version, push a matching `vX.Y.Z` tag, and publish a GitHub Release for that tag. The workflow checks that the release tag matches the package version, runs `npm ci` and `npm run check`, and publishes with provenance.
