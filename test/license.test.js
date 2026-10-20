import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPair, issueLicense, parseLicense, verifyLicense, LicenseStatus } from '../src/index.js';

const { privateKey, publicKey } = generateKeyPair();
const publicKeys = new Map([['test-key', publicKey]]);
const now = new Date('2026-09-24T08:00:00Z');
const payload = {
  licenseId: 'LIC-001',
  product: { id: 'example', version: '5' },
  type: 'subscription',
  customer: { id: 'customer-1', name: 'Acme Corporation' },
  validity: { issuedAt: '2026-09-24T08:00:00Z', expiresAt: '2027-09-24T08:00:00Z' },
  features: [{ id: 'export', enabled: true }, { id: 'sso', enabled: false }],
  limits: [{ id: 'users', value: '50' }],
  machine: { type: 'none' },
};

function issue(value = payload) {
  return issueLicense(value, { keyId: 'test-key', privateKey });
}

test('issues and verifies a signed license', () => {
  const xml = issue();
  const result = verifyLicense(xml, { publicKeys, productId: 'example', productVersion: '5', now });
  assert.equal(result.status, LicenseStatus.VALID);
  assert.deepEqual(result.license, payload);
});

test('rejects modified payloads and unknown keys', () => {
  const xml = issue();
  assert.equal(verifyLicense(xml.replace('<name>Acme Corporation</name>', '<name>Other Corporation</name>'), { publicKeys, now }).status, LicenseStatus.INVALID_SIGNATURE);
  assert.equal(verifyLicense(xml, { publicKeys: new Map(), now }).status, LicenseStatus.INVALID_SIGNATURE);
  assert.equal(verifyLicense(xml.replace('algorithm="Ed25519"', 'algorithm="RSA"'), { publicKeys, now }).status, LicenseStatus.INVALID_SIGNATURE);
});

test('canonicalizes XML lexical variations while preserving signed whitespace', () => {
  const xml = issue();
  const reorderedAttributes = xml.replace('algorithm="Ed25519" keyId="test-key"', 'keyId="test-key" algorithm="Ed25519"');
  assert.equal(verifyLicense(reorderedAttributes, { publicKeys, now }).status, LicenseStatus.VALID);
  const withComment = xml.replace('<payload>', '<payload><!-- comment -->');
  assert.equal(verifyLicense(withComment, { publicKeys, now }).status, LicenseStatus.VALID);
  const reindented = xml.replace('\n  <product>', '\n    <product>');
  assert.equal(verifyLicense(reindented, { publicKeys, now }).status, LicenseStatus.INVALID_SIGNATURE);
});

test('applies product, validity, and machine checks only after signature verification', () => {
  const xml = issue();
  assert.equal(verifyLicense(xml, { publicKeys, productId: 'other', now }).status, LicenseStatus.PRODUCT_MISMATCH);
  assert.equal(verifyLicense(xml, { publicKeys, now: new Date('2026-09-24T07:59:59Z') }).status, LicenseStatus.NOT_YET_VALID);
  assert.equal(verifyLicense(xml, { publicKeys, now: new Date('2027-09-24T08:00:00Z') }).status, LicenseStatus.EXPIRED);

  const bound = issue({
    ...payload,
    machine: { type: 'fingerprint', value: 'a'.repeat(64) },
  });
  assert.equal(verifyLicense(bound, { publicKeys, now, machineFingerprint: 'b'.repeat(64) }).status, LicenseStatus.MACHINE_MISMATCH);
  assert.equal(verifyLicense(bound, { publicKeys, now, machineFingerprint: 'a'.repeat(64) }).status, LicenseStatus.VALID);
});

test('rejects invalid structure, DTD, and duplicate feature identifiers', () => {
  const xml = issue();
  assert.equal(verifyLicense('<!DOCTYPE license [<!ENTITY x "x">]>' + xml, { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT);
  assert.equal(verifyLicense(xml.replace('encoding="UTF-8"', 'encoding="UTF-16"'), { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT);
  assert.equal(verifyLicense(xml.replace('<license version="1">', '<license xmlns="urn:test" version="1">'), { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT);
  assert.equal(verifyLicense(xml.replace('</features>', '<feature id="export" enabled="false"/></features>'), { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT);
  assert.throws(() => issue({ ...payload, unknown: true }));
});

test('supports perpetual licenses without an expiry', () => {
  const perpetual = {
    ...payload,
    type: 'perpetual',
    validity: { issuedAt: '2026-09-24T08:00:00Z' },
  };
  assert.equal(verifyLicense(issue(perpetual), { publicKeys, now: new Date('2099-01-01T00:00:00Z') }).status, LicenseStatus.VALID);
});

test('parses the payload without exposing private key material', () => {
  const parsed = parseLicense(issue());
  assert.equal(parsed.keyId, 'test-key');
  assert.equal(parsed.payload.licenseId, 'LIC-001');
  assert.equal(JSON.stringify(parsed).includes(privateKey), false);
});

test('supports CLI key generation, issuance, and verification', () => {
  const directory = mkdtempSync(join(tmpdir(), 'license-xml-'));
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const paths = {
    privateKey: join(directory, 'private.pem'),
    publicKey: join(directory, 'public.pem'),
    payload: join(directory, 'payload.json'),
    license: join(directory, 'test.license.xml'),
  };
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

  try {
    writeFileSync(paths.payload, JSON.stringify(payload));
    assert.equal(run('keygen', '--private', paths.privateKey, '--public', paths.publicKey).status, 0);
    assert.equal(run(
      'issue',
      '--payload', paths.payload,
      '--private', paths.privateKey,
      '--key-id', 'test-key',
      '--out', paths.license,
    ).status, 0);
    const result = run(
      'verify',
      '--file', paths.license,
      '--key-id', 'test-key',
      '--public-key', paths.publicKey,
      '--product-id', 'example',
      '--product-version', '5',
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /VALID/);
    assert.equal(readFileSync(paths.privateKey, { encoding: 'utf8' }).includes('PRIVATE KEY'), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
