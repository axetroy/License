import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { C14nCanonicalization } from 'xml-crypto';
import { XmlCanonicalizer } from 'xmldsigjs';

test('playground canonicalizer matches the Node.js license canonicalizer', () => {
  const xml = '<payload><licenseId>LIC-1</licenseId><product><id>my-product</id><version>5</version></product><feature enabled="true" id="export"/><name>Acme &amp; Co</name><!-- ignored --></payload>';
  const payload = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
  const nodeCanonical = new C14nCanonicalization().process(payload);
  const browserCanonical = new XmlCanonicalizer(false, false).Canonicalize(payload);

  assert.equal(browserCanonical, nodeCanonical);
});
