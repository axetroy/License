# License XML v1.0 format standard

License XML is a UTF-8 XML 1.0 document. Its payload is signed with Ed25519 after Canonical XML 1.0 canonicalization without comments.

## Document structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<license version="1">
  <payload>
    <licenseId>LIC-20261020-001</licenseId>
    <product>
      <id>my-product</id>
      <version>5</version>
    </product>
    <type>subscription</type>
    <customer>
      <id>CUSTOMER-001</id>
      <name>Example Customer</name>
      <email>customer@example.com</email>
    </customer>
    <validity>
      <issuedAt>2026-10-20T12:00:00Z</issuedAt>
      <expiresAt>2027-10-20T12:00:00Z</expiresAt>
    </validity>
    <features>
      <feature id="export" enabled="true"/>
    </features>
    <limits>
      <limit id="users">50</limit>
    </limits>
    <machine>
      <type>none</type>
    </machine>
  </payload>
  <signature algorithm="Ed25519" keyId="production-2026">BASE64_SIGNATURE</signature>
</license>
```

The root contains exactly one `payload`, followed by one `signature`. The payload's child elements occur in this order: `licenseId`, `product`, `type`, `customer`, `validity`, `features`, `limits`, and `machine`. XML namespaces, DTDs, entity declarations, unknown elements, and unknown attributes are not allowed.

## Fields and constraints

| Field | Meaning and rules |
| --- | --- |
| `licenseId` | Non-empty license identifier, at most 128 UTF-8 bytes. |
| `product/id` | Non-empty product identifier, at most 128 UTF-8 bytes. |
| `product/version` | Non-negative decimal integer without leading zeroes (except `0`). |
| `type` | `trial`, `subscription`, or `perpetual`. |
| `customer/id`, `customer/name` | Required non-empty values; `email` is optional. |
| `validity/issuedAt` | Required UTC timestamp in `YYYY-MM-DDTHH:mm:ssZ` form. |
| `validity/expiresAt` | Optional except for non-perpetual licenses; if present, later than `issuedAt`. |
| `features/feature` | Unique `id` and required `enabled="true"` or `enabled="false"`. |
| `limits/limit` | Unique `id` and a non-negative decimal integer value. |
| `machine/type` | `none` or `fingerprint`; fingerprint mode requires exactly 64 hexadecimal characters representing a SHA-256 digest in `machine/value`. |
| `signature` | 64-byte Ed25519 signature encoded as standard Base64; `keyId` identifies the trusted public key. |

Perpetual licenses omit `expiresAt`. Machine fingerprint collection and calculation are application responsibilities; the format does not prescribe hardware identifiers. When checking a license, the verifier compares the fingerprint hex characters without regard to letter case. The signed XML value itself remains case-sensitive payload text.

## Canonicalization

Only the `<payload>` element is signed. The signer and verifier canonicalize that element using Canonical XML 1.0 without comments and encode the result as UTF-8 before Ed25519 signing or verification. Whitespace that is part of text content remains significant. See the complete [License XML v1.0 protocol specification](./specification) for the normative definition.
