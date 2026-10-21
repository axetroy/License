# How License XML works

License XML uses Ed25519 digital signatures to protect a license payload. The license is a readable XML file; its signature verifies that a trusted issuer signed the payload and that it has not changed since issuance. A signature does not encrypt the license or provide online activation or usage metering.

## Participants and keys

| Participant | Holds | Responsibility |
| --- | --- | --- |
| Issuer | Ed25519 private key and license records | Validate authorization data and issue licenses |
| Application | One or more trusted public keys | Parse licenses, verify signatures, and check authorization conditions |
| User | License XML file | Store and provide the license to the application |

The private key stays on the issuing system and must never be embedded in a client or distributed to users. The application uses `keyId` to select a key from its trusted public-key set. During key rotation, new public keys can be added to the application; whether old keys remain trusted depends on the product's version policy.

## Issuance

```text
Issuer / license system
        │
        ├─ 1. Create payload
        │     licenseId, product, customer, validity,
        │     features, limits, and machine binding
        ▼
   Validate payload structure and fields
        │ failure → refuse issuance
        ▼
   Serialize as XML <payload>
        ▼
   Canonical XML 1.0 (without comments)
        ▼
   Sign canonical UTF-8 bytes with Ed25519 private key
        ▼
   Base64-encode signature; add algorithm and keyId
        ▼
   Output license XML ─────────────→ Distribute to user
                                      (license only, never the private key)
```

The signature covers only `<payload>`. Its fields include the license ID, product, customer, validity, features, limits, and machine binding; the root and signature elements are outside the signed content. The signature verifies only when the canonical payload bytes match. Lexical XML differences such as attribute order may not affect the signature, but whitespace in payload text is signed.

## Offline verification

```text
User provides license XML
        │
        ▼
Check XML size, syntax, and security restrictions
(reject DTDs, entity declarations, namespaces, etc.)
        │ failure → INVALID_FORMAT
        ▼
Check license structure, fields, and signature encoding
        │ failure → INVALID_FORMAT
        ▼
Read signature.keyId
        │
        ├─ unknown keyId / unsupported algorithm
        │       → INVALID_SIGNATURE
        ▼
Canonicalize the original <payload> and verify Ed25519 signature
        │ failure → INVALID_SIGNATURE
        ▼
Check caller-provided product ID / version
        │ mismatch → PRODUCT_MISMATCH
        ▼
Check issuedAt and expiresAt
        ├─ not yet valid → NOT_YET_VALID
        └─ expired       → EXPIRED
        ▼
Check machine binding
        └─ missing or mismatched fingerprint → MACHINE_MISMATCH
        ▼
VALID: pass signed features and limits to application enforcement
```

The order matters: the application can trust authorization claims only after signature verification succeeds. With machine type `none`, the verifier does not compare a fingerprint. With `fingerprint`, the integrating application must provide the current fingerprint. Collection, stability, and resistance to spoofing are application responsibilities.

`verifyLicense` performs local format, signature, product, time, and machine-fingerprint checks. The caller supplies product IDs, versions, and fingerprints; if product parameters are omitted, those matching checks are skipped. `VALID` means the license passed these checks, not that the application has enforced its feature flags or usage limits.

## Optional online activation and revocation

When fully offline, the client has no server state: it cannot discover whether a license was revoked or stop the same file from being copied to multiple unbound devices. If a product must limit activations, device seats, or support remote revocation, the integrating application needs to implement a separate server-side workflow. The following is **illustrative and not defined by this protocol**; this project provides no activation/revocation API or server-side state database.

```text
First launch / periodic connection
        │
        ▼
Client first performs local signature and authorization checks
        │ invalid → deny use
        ▼
Submit licenseId and device identifier to application server
(application defines authentication and device identity)
        │
        ▼
Server checks license status and activated devices
        │
        ├─ revoked / expired → deny
        ├─ device-seat limit exceeded → deny or require deactivation
        └─ activation allowed → atomically register or update device
                                      │
                                      ▼
                             Return an application-defined result
```

The server should be authoritative for license status and device seats, and handle concurrent activations, duplicate requests, device replacement, and deactivation safely. `licenseId` is an identifier, not a secret or anti-copy credential. Since a client can be modified, online checks alone cannot guarantee that the application always performs them; assess this risk alongside the application's own tamper resistance and business policy.

## Security boundaries

- A valid signature proves that the payload matches what was signed and that the corresponding private key produced the signature; it does not prove that the license has not been revoked.
- Offline verification cannot discover server-side state or guarantee a trustworthy system clock.
- The license is readable; signatures provide no confidentiality.
- Machine binding does not replace signature verification. Device identification and its reliability are application-level concerns.
- The application must enforce feature permissions and usage limits. The license format cannot prevent clients from being patched or debugged.
