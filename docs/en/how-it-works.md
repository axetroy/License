# How License XML works

## Key roles

The issuer keeps an Ed25519 private key secret. Applications distribute only trusted public keys, indexed by `keyId`. A private key must never be embedded in a client application or shared with users.

## Issuing

1. Build and validate the license payload.
2. Serialize the payload as XML.
3. Canonicalize `<payload>` with Canonical XML 1.0 without comments.
4. Sign the canonical UTF-8 bytes with the Ed25519 private key.
5. Encode the 64-byte signature as Base64 and add the `signature` element.

## Verifying

1. Parse the XML with strict structure and size checks.
2. Resolve `keyId` to a trusted public key.
3. Canonicalize the exact payload element and verify its signature.
4. Only after cryptographic verification, check product, time validity, and any application-provided machine fingerprint.

If a signed field changes, signature verification fails. XML syntax differences that canonicalize to the same bytes do not alter the signature. Text whitespace is signed and must not be casually reformatted.

## Security boundaries

A valid signature establishes payload integrity and possession of the corresponding private key at issuance time. Offline verification cannot discover remote revocation, prevent users from patching the application, or guarantee a trustworthy system clock. Feature enforcement, usage limits, fingerprint collection, and revocation are application-level responsibilities. The license document is readable and is not encrypted.
