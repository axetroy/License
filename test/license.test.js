import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
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

test('supports optional fields, Buffer keys, and object key registries', () => {
  const completePayload = {
    ...payload,
    licenseId: '许可证-001',
    type: 'perpetual',
    customer: { id: 'customer-1', name: 'Acme & Co', email: 'licenses@example.com' },
    validity: { issuedAt: '2026-09-24T08:00:00Z' },
    features: [],
    limits: [],
  };
  const xml = issueLicense(completePayload, {
    keyId: 'key.with-dash_and.dot',
    privateKey: Buffer.from(privateKey),
  });

  assert.deepEqual(parseLicense(xml).payload, completePayload);
  assert.equal(verifyLicense(xml, {
    publicKeys: { 'key.with-dash_and.dot': publicKey },
    productVersion: 5,
    now,
  }).status, LicenseStatus.VALID);
  assert.equal(verifyLicense(xml, {
    publicKeys: { 'key.with-dash_and.dot': publicKey },
    productVersion: 6,
    now,
  }).status, LicenseStatus.PRODUCT_MISMATCH);
});

test('rejects invalid verification options and malformed license inputs', () => {
  const xml = issue();
  const invalidSignature = xml.replace(
    /(<signature[^>]*>)[^<]+/,
    (_, start) => `${start}${Buffer.alloc(64).toString('base64')}`,
  );

  assert.equal(verifyLicense(xml, { publicKeys: publicKey, now }).status, LicenseStatus.INVALID_SIGNATURE);
  assert.equal(verifyLicense(xml, { publicKeys: new Map([['test-key', 'not a key']]), now }).status, LicenseStatus.INVALID_SIGNATURE);
  assert.equal(verifyLicense('not xml', { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT);
  assert.equal(verifyLicense(invalidSignature, { publicKeys, now }).status, LicenseStatus.INVALID_SIGNATURE);
  assert.equal(verifyLicense(xml, { publicKeys, now: 'not a date' }).status, LicenseStatus.INVALID_FORMAT);
  assert.equal(parseLicense(`\uFEFF${xml.replace('encoding="UTF-8"', 'encoding="utf-8"')}`).payload.licenseId, payload.licenseId);
  assert.throws(() => parseLicense(null), /must be a string/);
  assert.throws(() => parseLicense(`${xml}unexpected`));
  assert.throws(() => parseLicense(`<?custom data?>${xml.replace(/^<\?xml[^?]*\?>\n/, '')}`), /unexpected content outside license root/);
});

test('rejects invalid issue payloads and non-canonical protocol values', () => {
  assert.throws(() => issueLicense(null, { keyId: 'test-key', privateKey }));
  assert.throws(() => issueLicense(payload, { keyId: '', privateKey }));
  assert.throws(() => issueLicense(payload, { keyId: 'x'.repeat(129), privateKey }));
  assert.throws(() => issueLicense(payload, { keyId: 'invalid key', privateKey }));
  assert.throws(() => issueLicense(payload, { keyId: 'test-key', privateKey: {} }));
  assert.throws(() => issue({ ...payload, product: null }));
  assert.throws(() => issue({ ...payload, features: null }));
  assert.throws(() => issue({ ...payload, type: 'invalid' }));
  assert.throws(() => issue({ ...payload, licenseId: 'x'.repeat(129) }));
  assert.throws(() => issue({ ...payload, product: { id: 'example', version: '05' } }));
  assert.throws(() => issue({ ...payload, customer: { id: '', name: 'Acme' } }));
  assert.throws(() => issue({
    ...payload,
    validity: { issuedAt: '2026-02-30T08:00:00Z', expiresAt: '2027-09-24T08:00:00Z' },
  }));
  assert.throws(() => issue({
    ...payload,
    validity: { issuedAt: '2026-09-24T08:00:00Z', expiresAt: '2026-09-24T08:00:00Z' },
  }));
  assert.throws(() => issue({ ...payload, machine: { type: 'fingerprint' } }));
  assert.throws(() => issue({ ...payload, machine: { type: 'fingerprint', value: 'z'.repeat(64) } }));
  assert.throws(() => issue({ ...payload, machine: { type: 'none', value: 'unexpected' } }));
  assert.throws(() => issue({ ...payload, features: [{ id: 'bad id', enabled: true }] }));
  assert.throws(() => issue({ ...payload, features: [{ id: 'export', enabled: true }, { id: 'export', enabled: false }] }));
  assert.throws(() => issue({ ...payload, limits: [{ id: 'users', value: '01' }] }));
  assert.throws(() => issue({ ...payload, limits: [{ id: 'users', value: -1 }] }));
  assert.throws(() => issue({ ...payload, licenseId: '\u0000' }));
});

test('rejects XML that violates the license schema or parser constraints', () => {
  const xml = issue();
  const invalidXml = [
    xml.replace('<license version="1">', '<license version="2">'),
    xml.replace('<license version="1">', '<license version="1" extra="x">'),
    xml.replace('<payload>', '<payload extra="x">'),
    xml.replace('<license version="1">', '<other version="1">'),
    xml.replace('</license>', '<extra/></license>'),
    xml.replace('<license version="1">', '<license version="1">unexpected'),
    xml.replace('<type>subscription</type>', '<type> invalid </type>'),
    xml.replace('<product>', '<product xmlns="urn:test">'),
    xml.replace('<licenseId>LIC-001</licenseId>', '<licenseId></licenseId>'),
    xml.replace('<version>5</version>', '<version>05</version>'),
    xml.replace('<expiresAt>2027-09-24T08:00:00Z</expiresAt>', '<expiresAt>2026-01-01T00:00:00Z</expiresAt>'),
    xml.replace('enabled="true"', 'enabled="yes"'),
    xml.replace('id="export"', 'id="bad id"'),
    xml.replace('<limit id="users">50</limit>', '<limit id="users">050</limit>'),
    xml.replace('<machine>', '<machine extra="x">'),
    xml.replace('<signature algorithm="Ed25519"', '<signature xmlns="urn:test" algorithm="Ed25519"'),
    xml.replace('</license>', '</license><extra/>'),
    '<license',
    `${xml}${' '.repeat(1024 * 1024)}`,
  ];

  for (const invalid of invalidXml) {
    assert.equal(verifyLicense(invalid, { publicKeys, now }).status, LicenseStatus.INVALID_FORMAT, invalid);
  }
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
    assert.equal(run().status, 0);
    assert.equal(run('--help').status, 0);
    assert.equal(run('-h').status, 0);
    assert.equal(run('unknown').status, 2);
    assert.equal(run('keygen', '--private').status, 2);
    assert.equal(run('keygen', '--private', 'one', '--private', 'two').status, 2);
    assert.equal(run('keygen', '--private', 'one', '--public', 'two', '--extra', 'value').status, 2);
    assert.equal(run('keygen', '--private', 'same', '--public', 'same').status, 2);
    writeFileSync(paths.payload, JSON.stringify(payload));
    assert.equal(run('keygen', '--private', paths.privateKey, '--public', paths.publicKey).status, 0);
    const originalPrivateKey = readFileSync(paths.privateKey, 'utf8');
    assert.equal(run('keygen', '--private', paths.privateKey, '--public', paths.publicKey).status, 2);
    assert.equal(readFileSync(paths.privateKey, 'utf8'), originalPrivateKey);
    const rollbackPrivate = join(directory, 'rollback.private.pem');
    const existingPublic = join(directory, 'existing.public.pem');
    writeFileSync(existingPublic, 'already exists');
    assert.equal(run('keygen', '--private', rollbackPrivate, '--public', existingPublic).status, 2);
    assert.equal(existsSync(rollbackPrivate), false);
    assert.equal(run(
      'issue',
      '--payload', paths.payload,
      '--private', paths.privateKey,
      '--key-id', 'test-key',
      '--out', paths.license,
    ).status, 0);
    const originalLicense = readFileSync(paths.license, 'utf8');
    assert.equal(run(
      'issue',
      '--payload', paths.payload,
      '--private', paths.privateKey,
      '--key-id', 'test-key',
      '--out', paths.license,
    ).status, 2);
    assert.equal(readFileSync(paths.license, 'utf8'), originalLicense);
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
    const tamperedLicense = join(directory, 'tampered.license.xml');
    writeFileSync(tamperedLicense, originalLicense.replace('LIC-001', 'LIC-002'));
    const tamperedResult = run(
      'verify',
      '--file', tamperedLicense,
      '--key-id', 'test-key',
      '--public-key', paths.publicKey,
    );
    assert.equal(tamperedResult.status, 1);
    assert.match(tamperedResult.stdout, /INVALID_SIGNATURE/);
    assert.equal(readFileSync(paths.privateKey, { encoding: 'utf8' }).includes('PRIVATE KEY'), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
