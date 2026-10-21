---
title: License XML
titleTemplate: Offline license format
description: Human-readable offline software licenses signed with Ed25519.
layout: home
hero:
  name: License XML
  text: Offline licenses, verifiable anywhere
  tagline: A readable XML license format secured with Ed25519 and Canonical XML 1.0.
  actions:
    - theme: brand
      text: Read the format standard
      link: /en/format
    - theme: alt
      text: Open the playground
      link: /en/playground
features:
  - title: Offline verification
    details: Applications verify signatures locally with a public key. No license server is required.
  - title: Tamper evident
    details: Ed25519 signs the canonicalized payload. Changing signed data invalidates the signature.
  - title: Human readable
    details: Licenses are UTF-8 XML with a documented, strict structure.
---

## Documentation

- [Format standard](./format): XML structure, field rules, and canonicalization.
- [Protocol specification](./specification): The complete normative definition of License XML v1.0.
- [How it works](./how-it-works): key roles, signing, verification, and security boundaries.
- [Usage guide](./guide): install the package, use the API, and run the CLI.
- [Playground](./playground): sign and verify a demo license in your browser.
