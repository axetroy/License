# License XML v1.0 Protocol Specification

Specification for the software license file protocol.

| Property | Value |
| --- | --- |
| Protocol name | License XML |
| Protocol version | 1.0 |
| File format | XML 1.0 |
| Character encoding | UTF-8 |
| Signature algorithm | Ed25519 |
| XML canonicalization | Canonical XML 1.0 (without comments) |
| Digest algorithm | SHA-256 (for machine fingerprints) |
| Signature encoding | Base64 |
**Design goals:** Human-readable, editable, tamper-evident, and verifiable offline

---

## 1. Protocol Goals

License XML v1.0 defines a software license file format.

A license must have the following properties:

1. License content is stored as plain-text XML.
2. Users can open a license and read all authorization information.
3. Users can edit the XML directly.
4. If a user changes authorization information that is part of the protected canonical content, verification of the original signature must fail.
5. Only the licensing server holds the license-issuing private key.
6. Clients hold only public keys.
7. Clients can verify license signatures without accessing a server.
8. Licenses support validity periods, feature permissions, quantity limits, customer information, and machine binding.
9. Licenses support signing-key rotation.
10. License files do not provide confidentiality.
11. This protocol defines only the offline license format and signature. Revocation services, hardware fingerprint collection, and usage metering belong to the application layer.

---

## 2. Security Model

License XML v1.0 uses asymmetric digital signatures.

The server has:

```text
Private Key
```

The client has:

```text
Public Key
```

Issuance:

```text
License Payload
       │
       ▼
XML Canonicalization
       │
       ▼
Ed25519 Sign
       │
       ▼
Signature
```

Verification:

```text
License XML
       │
       ▼
Read Payload
       │
       ▼
XML Canonicalization
       │
       ▼
Ed25519 Verify
       │
       ▼
Valid / Invalid
```

The client must not contain the license-issuing private key.

---

## 3. Security Boundary

License XML v1.0 guarantees:

> **When signature verification succeeds, the Payload content is identical to the content at issuance, and the signature was produced by the corresponding private key.**

License XML v1.0 does not guarantee that:

* Users cannot modify the client program.
* Users cannot patch the client.
* Users cannot debug the client.
* Users cannot change the system clock.
* Users cannot simulate the client runtime environment.

The license system protects:

```text
License Integrity
```

not:

```text
Application Integrity
```

---

## 4. File Extension

The license file extension is fixed as:

```text
.license.xml
```

Example:

```text
my-product.license.xml
```

---

## 5. XML Document Structure

The license root element is fixed as:

```xml
<license>
```

The complete structure is:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<license version="1">

    <payload>

        <licenseId>...</licenseId>

        <product>
            <id>...</id>
            <version>...</version>
        </product>

        <type>...</type>

        <customer>
            <id>...</id>
            <name>...</name>
            <email>...</email>
        </customer>

        <validity>
            <issuedAt>...</issuedAt>
            <expiresAt>...</expiresAt>
        </validity>

        <features>
            ...
        </features>

        <limits>
            ...
        </limits>

        <machine>
            ...
        </machine>

    </payload>

    <signature
        algorithm="Ed25519"
        keyId="...">...</signature>

</license>
```

---

## 6. Root Element

The root element is:

```xml
<license version="1">
```

`version` is the license file protocol version. In v1.0:

```text
version = "1"
```

Any other value is an unknown protocol version.

---

## 7. Payload

All authorization information must be inside the `<payload>` element.

The Payload is the **complete signed object**. Its child elements must appear in the order shown in Section 5. Each single-value element must appear exactly once. The only optional elements are `customer/email` and `validity/expiresAt`, with `expiresAt` required or omitted according to the license type.

All of the following are within the signature's protection:

```text
licenseId
product
type
customer
validity
features
limits
machine
```

Changing the canonical content of any field must cause signature verification to fail. XML comments are not signed. Changes only to XML lexical form, such as attribute order, quote style, and character references, may not affect the signature.

Version 1 documents must not use XML namespaces, DTDs, external entities, or internal entity declarations. Undefined elements, duplicate singleton elements, duplicate attributes, and any other content that does not conform to the structure below are forbidden. Parsers must reject DTDs and entity declarations and must not attempt to load external resources.

---

## 8. License ID

Structure:

```xml
<licenseId>LIC-20260924-00123</licenseId>
```

A License ID must be:

* Globally unique.
* UTF-8.
* 1–128 bytes long.
* Case-sensitive.

The License ID is only a unique license identifier; it does not participate in authorization decisions.

---

## 9. Product

Product structure:

```xml
<product>
    <id>my-product</id>
    <version>5</version>
</product>
```

`id` identifies the product. `version` identifies the major product version to which the license applies.

`id` must be 1–128 UTF-8 bytes. `version` must be a non-negative decimal integer without leading zeroes.

For example:

```xml
<product>
    <id>my-editor</id>
    <version>5</version>
</product>
```

authorizes version `5.x` of `my-editor`.

---

## 10. License Type

License type:

```xml
<type>trial</type>
```

The protocol supports exactly:

```text
trial
subscription
perpetual
```

### trial

A trial license. `<expiresAt>` is required.

### subscription

A subscription license. `<expiresAt>` is required.

### perpetual

A perpetual license. `<expiresAt>` must be omitted.

---

## 11. Customer

Structure:

```xml
<customer>
    <id>CUSTOMER-001</id>
    <name>Acme Corporation</name>
    <email>admin@example.com</email>
</customer>
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Unique customer ID |
| `name` | Yes | Customer name |
| `email` | No | Customer email |

Customer information is within the signature's protection. Therefore, changing:

```xml
<name>Acme Corporation</name>
```

to:

```xml
<name>Other Corporation</name>
```

must cause license verification to fail.

---

## 12. Validity

Structure:

```xml
<validity>
    <issuedAt>2026-09-24T08:00:00Z</issuedAt>
    <expiresAt>2027-09-24T08:00:00Z</expiresAt>
</validity>
```

`issuedAt` is required. `expiresAt` is required for `trial` and `subscription` licenses and must be omitted for `perpetual` licenses. All times must use ISO 8601 UTC in this format:

```text
YYYY-MM-DDTHH:mm:ssZ
```

For example:

```text
2026-09-24T08:00:00Z
```

Times must be valid calendar times. Fractional seconds, timezone offsets, and leap seconds are not accepted. `expiresAt` is an exclusive boundary and must be later than `issuedAt`. A verifier must not add clock tolerance that is not defined here.

---

## 13. Features

Feature permissions use:

```xml
<features>
    <feature id="api" enabled="true"/>
    <feature id="export" enabled="true"/>
    <feature id="advanced" enabled="true"/>
    <feature id="sso" enabled="false"/>
</features>
```

A feature ID must match:

```text
[a-zA-Z0-9._-]+
```

Each `feature` must have exactly two attributes, `id` and `enabled`. IDs must be unique within the same `<features>` element. `enabled` accepts only the strings `true` and `false`.

The `enabled` value determines whether a feature is authorized: `enabled="true"` means authorized, and `enabled="false"` means not authorized.

The entire `<features>` element is within the signature's protection.

---

## 14. Limits

Quantity limits use:

```xml
<limits>
    <limit id="users">50</limit>
    <limit id="projects">100</limit>
    <limit id="apiRequestsPerMonth">100000</limit>
</limits>
```

`id` identifies the limit type. It must match `[a-zA-Z0-9._-]+` and be unique within the same `<limits>` element.

The element content must be a non-negative decimal integer without leading zeroes (`0` or `[1-9][0-9]*`).

For example:

```xml
<limit id="users">50</limit>
```

means a maximum of 50 users.

---

## 15. Machine Binding

Machine binding structure:

```xml
<machine>
    <type>fingerprint</type>
    <value>...</value>
</machine>
```

`type` supports exactly:

```text
none
fingerprint
```

When `<type>none</type>` is used, `<value>` must be absent. When `<type>fingerprint</type>` is used, `<value>` must be present.

`value` is a machine fingerprint digest calculated by the application and provided to the verifier. The protocol does not define which hardware or system identifiers to collect or how to normalize them, and hardware information must not be collected implicitly. The client should compare it with the current fingerprint supplied by the caller; hexadecimal letters are compared case-insensitively. This comparison rule does not change the signature's protection of the original text in the payload. The digest must use the SHA-256 hexadecimal form and contain exactly 64 characters:

```text
64 hexadecimal characters
```

For example:

```text
8A71F4D2...
```

---

## 16. Signature

Signature structure:

```xml
<signature
    algorithm="Ed25519"
    keyId="production-2026">BASE64_SIGNATURE</signature>
```

`algorithm` is fixed as:

```text
Ed25519
```

`keyId` selects the public key used for verification. It must be 1–128 ASCII characters and may contain only letters, digits, periods, underscores, and hyphens.

The text content of the `signature` element is the Ed25519 signature encoded as Base64. An Ed25519 signature must be exactly 64 bytes; the Base64 content must not contain whitespace.

---

## 17. Signature Scope

The signature applies only to the `<payload>` element. The `<license>` and `<signature>` elements are not signed.

The signature input is:

```text
CanonicalXML1.0(payload)
```

The canonicalization algorithm URI is fixed as `http://www.w3.org/TR/2001/REC-xml-c14n-20010315` (without comments).

```text
payload
   ↓
Canonical XML 1.0 (without comments)
   ↓
UTF-8 bytes
   ↓
Ed25519.Sign()
```

---

## 18. Signature Verification

The client performs these steps:

```text
Read product.license.xml
        ↓
Parse XML
        ↓
Validate protocol version
        ↓
Read signature.keyId
        ↓
Obtain corresponding Public Key
        ↓
Canonicalize(payload)
        ↓
Base64-decode(signature)
        ↓
Ed25519 Verify
```

If verification returns `false`, the license status must immediately be set to:

```text
INVALID_SIGNATURE
```

License authorization checks must not continue.

---

## 19. Key System

Each signing key has a unique `keyId`, for example:

```text
production-2026
production-2027
```

The server stores the private key. The client stores public keys, for example:

```text
production-2026 → Public Key A
production-2027 → Public Key B
```

The private key must never be included in the client, license, installation package, source code, or frontend code.

---

## 20. Key Rotation

The server generates a new key, for example `production-2027`. The client publishes a new version that adds:

```text
production-2027 → Public Key B
```

The server then issues new licenses using `production-2027`. Existing licenses continue to be verified with `production-2026`.

Whether old keys continue to be accepted is determined by the client version.

---

## 21. XML Comments

XML comments are allowed:

```xml
<!-- License generated by License Server -->
```

Comments are not Payload data and do not affect license business content. Clients must not execute authorization logic based on XML comments.

---

## 22. XML Formatting

Element text values must be non-empty and must not contain leading or trailing whitespace. Customer email is optional; if present, it must be non-empty. The `feature` and `limit` collections may be empty.

The following XML:

```xml
<limit id="users">50</limit>
```

and:

```xml
<limit id="users">
    50
</limit>
```

do not represent the same Payload data. Therefore, license generators must emit canonical formatting.

Payloads must not contain insignificant text whitespace. Canonical XML does not remove whitespace text between elements. If indentation is parsed as text nodes inside a Payload, that whitespace is part of the signed content; re-indentation may cause signature verification to fail. Comments are not signed. For example, `50` is the complete element value in:

```xml
<users>50</users>
```

---

## 23. User Modification Rules

Users may edit the XML file. However, any field change that alters the canonical content of the Payload causes signature verification to fail:

```text
Signature Verification = FAIL
```

For example, changing:

```xml
<limit id="users">50</limit>
```

to:

```xml
<limit id="users">5000</limit>
```

results in `INVALID_SIGNATURE`. The same applies to changes to `<expiresAt>`, a feature such as `<feature id="enterprise" enabled="false"/>`, or customer information.

---

## 24. License Status

An offline verifier produces only the following statuses:

```text
VALID
INVALID_FORMAT
INVALID_SIGNATURE
PRODUCT_MISMATCH
NOT_YET_VALID
EXPIRED
MACHINE_MISMATCH
```

`REVOKED` may only be returned by an online revocation service; it is not a signature or offline verification status. This protocol does not define a revocation API. If the verifier cannot connect to or does not integrate with a revocation service, it must not claim that revocation status was checked.

Status checks occur in this fixed order:

```text
1. XML Parse
2. Schema Validation
3. Signature Verification
4. Product Validation
5. Time Validation
6. Machine Validation
7. Pass the signed Feature / Limit data to application-layer authorization logic
```

XML parsing or structural validation failures return `INVALID_FORMAT`. An invalid signature, unsupported algorithm, or unknown `keyId` returns `INVALID_SIGNATURE`. Product matching parameters may be omitted by the caller; if provided, all must match. Expiration uses an exclusive boundary: a license is expired when the current time is equal to `expiresAt`.

---

## 25. Complete License Example

Example license file:

```xml
<?xml version="1.0" encoding="UTF-8"?>

<license version="1">

    <!--
        License XML v1.0
    -->

    <payload>

        <licenseId>LIC-20260924-00123</licenseId>

        <product>
            <id>my-product</id>
            <version>5</version>
        </product>

        <type>subscription</type>

        <customer>
            <id>CUSTOMER-001</id>
            <name>Acme Corporation</name>
            <email>admin@example.com</email>
        </customer>

        <validity>
            <issuedAt>2026-09-24T08:00:00Z</issuedAt>
            <expiresAt>2027-09-24T08:00:00Z</expiresAt>
        </validity>

        <features>
            <feature id="api" enabled="true"/>
            <feature id="export" enabled="true"/>
            <feature id="advanced" enabled="true"/>
            <feature id="sso" enabled="false"/>
        </features>

        <limits>
            <limit id="users">50</limit>
            <limit id="projects">100</limit>
            <limit id="apiRequestsPerMonth">100000</limit>
        </limits>

        <machine>
            <type>fingerprint</type>
            <value>8A71F4D2E39F0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123</value>
        </machine>

    </payload>

    <signature
        algorithm="Ed25519"
        keyId="production-2026">V3J0dGVuU2lnbmF0dXJl...</signature>

</license>
```

**Note:** The example signature is illustrative and is not a verifiable license. The example machine fingerprint is not the real fingerprint of a specific machine.

---

## 26. Issuer

The server performs:

```text
Create Payload
       ↓
Validate structure
       ↓
Canonical XML 1.0 (without comments)
       ↓
Ed25519 Private Key
       ↓
Base64
       ↓
Create Signature
       ↓
Generate product.license.xml
```

The server stores the private key and the license database.

---

## 27. Client

The client embeds public keys and reads:

```text
product.license.xml
```

It then performs:

```text
Parse
 ↓
Schema validation
 ↓
Canonicalization
 ↓
Ed25519 verification
 ↓
Business validation
```

---

## 28. License Database

The following is only a server implementation suggestion. It is not part of the protocol's data format or a mandatory server behavior. An application that provides online revocation may record:

```text
licenseId
customerId
productId
licenseType
issuedAt
expiresAt
status
keyId
machineFingerprint
```

`status` is one of:

```text
active
revoked
```

The license file does not contain an `active` status. A signature proves the license content and its origin, not that the license has not been revoked.

The revocation service API, authentication, caching strategy, and failure behavior must be defined separately by the application.

---

## 29. Offline Licenses

In fully offline mode:

```text
product.license.xml
     ↓
Signature
     ↓
Local validation
```

Local validation can check:

```text
Whether the content has been modified
Whether the signature is authentic
Whether the product matches
Whether the license has expired
Whether the machine matches
The signed feature permissions and quantity limits
```

Local validation reads only these signed authorization claims. Enforcing feature flags and metering usage is the application's responsibility. The caller must provide the machine fingerprint; the protocol and verifier do not collect it.

Local validation cannot determine whether the server has just revoked a license because the client has no server connection.

---

## 30. Online Licenses

An online license system may add a custom revocation service. The following is an illustrative, non-normative flow; this protocol does not define its interface or online verification statuses:

```text
License Server
```

The client may:

```text
Read product.license.xml
       ↓
Verify local signature
       ↓
Query the server with licenseId
       ↓
Check status
       ↓
ACTIVE / REVOKED
```

After the server revokes a license:

```text
status = revoked
```

An online client, as defined by its application, should reject a license after the revocation service successfully reports `revoked`. The application defines its own failure and caching policies.

---

## 31. Core Security Property

The core guarantee of License XML v1.0 can be summarized as:

```text
The server has the private key
        ↓
The server signs the Payload
        ↓
The user can see the Payload
        ↓
The user can modify the Payload
        ↓
But the user does not have the private key
        ↓
The user cannot create a valid new Signature
        ↓
The modified License cannot pass verification
```

Therefore:

> **A license does not need to be hidden. Its security comes from its signature, not from content confidentiality.**

---

## 32. Final Protocol Definition

License XML v1.0 is defined as follows:

```text
File format       XML 1.0
Encoding          UTF-8
Root element      license
Payload           payload
Signature         Ed25519
Signature scope   payload
Canonicalization  Canonical XML 1.0 (without comments)
Signature encoding Base64
Key identifier    keyId
Time format       ISO 8601 UTC
Machine fingerprint SHA-256
```

The central relationship of the protocol is:

```text
Signature = Ed25519.Sign(
    PrivateKey,
    CanonicalXML1.0(Payload)
)
```

Verification:

```text
Ed25519.Verify(
    PublicKey,
    CanonicalXML1.0(Payload),
    Signature
)
```

**Any change that alters the canonical content of the Payload causes verification to fail.**

This definition can serve as the protocol basis for License XML v1.0. Implementations need only implement the issuer and verifier according to this specification; no further design of license fields or signature mechanisms is needed.
