# Browser playground

The playground lets you edit a license payload, sign it with a temporary Ed25519 key, and verify or tamper with the resulting XML.

<div class="playground-frame">
  <iframe src="/License/playground/?lang=en" title="License XML browser playground" loading="lazy" referrerpolicy="no-referrer"></iframe>
</div>

All signing and verification happen in your browser. The private key is held only in page memory and is lost when you reload. Never use the demo key to issue real licenses. A machine-bound license requires the integrating application to provide its fingerprint; the playground does not collect device information.

Web Crypto Ed25519 requires a modern browser and a secure context (HTTPS or localhost).
