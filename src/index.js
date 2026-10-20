import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { C14nCanonicalization } from 'xml-crypto';

const MAX_XML_BYTES = 1024 * 1024;
const LICENSE_ID_BYTES = 128;
const IDENTIFIER = /^[a-zA-Z0-9._-]+$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const canonicalizer = new C14nCanonicalization();

export const LicenseStatus = Object.freeze({
  VALID: 'VALID',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  PRODUCT_MISMATCH: 'PRODUCT_MISMATCH',
  NOT_YET_VALID: 'NOT_YET_VALID',
  EXPIRED: 'EXPIRED',
  MACHINE_MISMATCH: 'MACHINE_MISMATCH',
});

export function generateKeyPair() {
  return generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

export function issueLicense(payload, { keyId, privateKey }) {
  assert(typeof keyId === 'string' && IDENTIFIER.test(keyId), 'keyId must use letters, digits, dot, underscore, or hyphen');
  assert(typeof privateKey === 'string' || Buffer.isBuffer(privateKey), 'privateKey must be a PEM string or buffer');

  const payloadXml = serializePayload(payload);
  const payloadNode = parseDocument(payloadXml).getElementsByTagName('payload')[0];
  const canonicalPayload = canonicalizer.process(payloadNode);
  const signature = sign(null, Buffer.from(canonicalPayload, 'utf8'), createPrivateKey(privateKey)).toString('base64');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<license version="1">',
    payloadXml,
    `  <signature algorithm="Ed25519" keyId="${escapeAttribute(keyId)}">${signature}</signature>`,
    '</license>',
    '',
  ].join('\n');
}

export function parseLicense(xml) {
  const document = parseDocument(xml);
  const root = document.documentElement;
  assert(root.nodeName === 'license' && !root.namespaceURI, 'root element must be unnamespaced <license>');
  assertAttributes(root, ['version']);
  assert(root.getAttribute('version') === '1', 'unsupported protocol version');
  assertDocumentChildren(document, root);
  const rootChildren = childElements(root);
  assertNames(rootChildren, ['payload', 'signature'], 'license');

  const payloadNode = rootChildren[0];
  const signatureNode = rootChildren[1];
  const payload = readPayload(payloadNode);

  assertAttributes(signatureNode, ['algorithm', 'keyId']);
  assertNoElementChildren(signatureNode, 'signature');
  const algorithm = signatureNode.getAttribute('algorithm');
  const keyId = signatureNode.getAttribute('keyId');
  assert(IDENTIFIER.test(keyId), 'invalid signature keyId');
  const signatureText = textContent(signatureNode);
  assert(BASE64.test(signatureText), 'signature is not canonical Base64');
  const signature = Buffer.from(signatureText, 'base64');
  assert(signature.length === 64 && signature.toString('base64') === signatureText, 'invalid Ed25519 signature length or encoding');

  return {
    payload,
    algorithm,
    keyId,
    signature,
    canonicalPayload: canonicalizer.process(payloadNode),
  };
}

export function verifyLicense(xml, options = {}) {
  let parsed;
  try {
    parsed = parseLicense(xml);
  } catch {
    return { status: LicenseStatus.INVALID_FORMAT };
  }

  if (parsed.algorithm !== 'Ed25519') return { status: LicenseStatus.INVALID_SIGNATURE };
  const publicKey = getPublicKey(options.publicKeys, parsed.keyId);
  if (!publicKey) return { status: LicenseStatus.INVALID_SIGNATURE };

  let signatureIsValid = false;
  try {
    signatureIsValid = verify(
      null,
      Buffer.from(parsed.canonicalPayload, 'utf8'),
      createPublicKey(publicKey),
      parsed.signature,
    );
  } catch {
    return { status: LicenseStatus.INVALID_SIGNATURE };
  }
  if (!signatureIsValid) return { status: LicenseStatus.INVALID_SIGNATURE };

  const { payload } = parsed;
  if (
    (options.productId !== undefined && payload.product.id !== options.productId) ||
    (options.productVersion !== undefined && payload.product.version !== String(options.productVersion))
  ) {
    return { status: LicenseStatus.PRODUCT_MISMATCH };
  }

  const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  if (!Number.isFinite(now)) return { status: LicenseStatus.INVALID_FORMAT };
  if (now < Date.parse(payload.validity.issuedAt)) return { status: LicenseStatus.NOT_YET_VALID };
  if (payload.validity.expiresAt && now >= Date.parse(payload.validity.expiresAt)) {
    return { status: LicenseStatus.EXPIRED };
  }

  if (
    payload.machine.type === 'fingerprint' &&
    (typeof options.machineFingerprint !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(options.machineFingerprint) ||
      payload.machine.value.toLowerCase() !== options.machineFingerprint.toLowerCase())
  ) {
    return { status: LicenseStatus.MACHINE_MISMATCH };
  }

  return { status: LicenseStatus.VALID, license: payload };
}

function parseDocument(xml) {
  assert(typeof xml === 'string', 'license XML must be a string');
  assert(Buffer.byteLength(xml, 'utf8') <= MAX_XML_BYTES, 'license XML exceeds the 1 MiB limit');
  assert(!/<!DOCTYPE\b|<!ENTITY\b/i.test(xml), 'DTD and entity declarations are forbidden');

  const errors = [];
  const document = new DOMParser({
    onError(level, message) {
      errors.push(`${level}: ${message}`);
    },
  }).parseFromString(xml, 'application/xml');
  assert(errors.length === 0, errors.join('; ') || 'malformed XML');
  assert(!document.doctype, 'DOCTYPE is forbidden');
  assert(document.documentElement, 'missing document element');
  return document;
}

function readPayload(payloadNode) {
  assert(payloadNode.nodeName === 'payload' && !payloadNode.namespaceURI, 'payload must be unnamespaced');
  assertAttributes(payloadNode, []);
  const fields = childElements(payloadNode);
  assertNames(fields, ['licenseId', 'product', 'type', 'customer', 'validity', 'features', 'limits', 'machine'], 'payload');

  const licenseId = readLeaf(fields[0], 'licenseId');
  assert(Buffer.byteLength(licenseId, 'utf8') > 0 && Buffer.byteLength(licenseId, 'utf8') <= LICENSE_ID_BYTES, 'licenseId must be 1–128 UTF-8 bytes');

  const productFields = readContainer(fields[1], 'product', ['id', 'version']);
  const productId = readLeaf(productFields.id, 'product/id');
  const productVersion = readLeaf(productFields.version, 'product/version');
  assert(Buffer.byteLength(productId, 'utf8') > 0 && Buffer.byteLength(productId, 'utf8') <= LICENSE_ID_BYTES, 'product id must be 1–128 UTF-8 bytes');
  assert(/^(0|[1-9][0-9]*)$/.test(productVersion), 'product version must be a non-negative decimal integer without leading zeros');

  const type = readLeaf(fields[2], 'type');
  assert(['trial', 'subscription', 'perpetual'].includes(type), 'invalid license type');

  const customerFields = readContainer(fields[3], 'customer', ['id', 'name', 'email'], { optional: ['email'] });
  const customer = {
    id: readLeaf(customerFields.id, 'customer/id'),
    name: readLeaf(customerFields.name, 'customer/name'),
  };
  if (customerFields.email) customer.email = readLeaf(customerFields.email, 'customer/email');
  assert(customer.id && customer.name, 'customer id and name are required');

  const validityFields = readContainer(fields[4], 'validity', ['issuedAt', 'expiresAt'], {
    optional: type === 'perpetual' ? ['expiresAt'] : [],
  });
  const validity = { issuedAt: readLeaf(validityFields.issuedAt, 'validity/issuedAt') };
  assertValidDate(validity.issuedAt, 'issuedAt');
  if (validityFields.expiresAt) {
    validity.expiresAt = readLeaf(validityFields.expiresAt, 'validity/expiresAt');
    assertValidDate(validity.expiresAt, 'expiresAt');
    assert(Date.parse(validity.expiresAt) > Date.parse(validity.issuedAt), 'expiresAt must be later than issuedAt');
  }

  const featuresNode = fields[5];
  assert(featuresNode.nodeName === 'features' && !featuresNode.namespaceURI, 'features element is invalid');
  assertAttributes(featuresNode, []);
  const features = childElements(featuresNode).map((feature) => {
    assert(feature.nodeName === 'feature' && !feature.namespaceURI, 'features may contain only feature elements');
    assertAttributes(feature, ['id', 'enabled']);
    const id = feature.getAttribute('id');
    const enabled = feature.getAttribute('enabled');
    assert(IDENTIFIER.test(id), 'invalid feature id');
    assert(enabled === 'true' || enabled === 'false', 'feature enabled must be true or false');
    assertNoElementChildren(feature, 'feature');
    assert(!textContent(feature).trim(), 'feature element must be empty');
    return { id, enabled: enabled === 'true' };
  });
  assertUnique(features.map(({ id }) => id), 'feature');

  const limitsNode = fields[6];
  assert(limitsNode.nodeName === 'limits' && !limitsNode.namespaceURI, 'limits element is invalid');
  assertAttributes(limitsNode, []);
  const limits = childElements(limitsNode).map((limit) => {
    assert(limit.nodeName === 'limit' && !limit.namespaceURI, 'limits may contain only limit elements');
    assertAttributes(limit, ['id']);
    const id = limit.getAttribute('id');
    const value = readLeaf(limit, 'limit', ['id']);
    assert(IDENTIFIER.test(id), 'invalid limit id');
    assert(/^(0|[1-9][0-9]*)$/.test(value), 'limit value must be a non-negative decimal integer without leading zeros');
    return { id, value };
  });
  assertUnique(limits.map(({ id }) => id), 'limit');

  const machineFields = readContainer(fields[7], 'machine', ['type', 'value'], { optional: ['value'] });
  const machineType = readLeaf(machineFields.type, 'machine/type');
  assert(machineType === 'none' || machineType === 'fingerprint', 'invalid machine binding type');
  const machine = { type: machineType };
  if (machineType === 'none') {
    assert(!machineFields.value, 'machine value must be omitted when type is none');
  } else {
    assert(machineFields.value, 'machine value is required for fingerprint binding');
    machine.value = readLeaf(machineFields.value, 'machine/value');
    assert(/^[a-fA-F0-9]{64}$/.test(machine.value), 'machine fingerprint must be 64 hexadecimal characters');
  }

  return {
    licenseId,
    product: { id: productId, version: productVersion },
    type,
    customer,
    validity,
    features,
    limits,
    machine,
  };
}

function serializePayload(payload) {
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'payload must be an object');
  assertKeys(payload, ['licenseId', 'product', 'type', 'customer', 'validity', 'features', 'limits', 'machine'], 'payload');
  const product = payload.product;
  const customer = payload.customer;
  const validity = payload.validity;
  const machine = payload.machine;
  assert(product && customer && validity && machine, 'payload is missing a required object');
  assertKeys(product, ['id', 'version'], 'product');
  assertKeys(customer, ['id', 'name', 'email'], 'customer');
  assertKeys(validity, ['issuedAt', 'expiresAt'], 'validity');
  assertKeys(machine, ['type', 'value'], 'machine');
  assert(Array.isArray(payload.features) && Array.isArray(payload.limits), 'features and limits must be arrays');

  const featureXml = payload.features.map((feature) => {
    assertKeys(feature, ['id', 'enabled'], 'feature');
    assert(typeof feature.enabled === 'boolean', 'feature enabled must be a boolean');
    return `      <feature id="${escapeAttribute(assertString(feature.id, 'feature id'))}" enabled="${feature.enabled}"/>`;
  }).join('\n');
  const limitXml = payload.limits.map((limit) => {
    assertKeys(limit, ['id', 'value'], 'limit');
    return `      <limit id="${escapeAttribute(assertString(limit.id, 'limit id'))}">${escapeText(String(limit.value))}</limit>`;
  }).join('\n');
  const emailXml = customer.email === undefined ? '' : `\n      <email>${escapeText(assertString(customer.email, 'customer email'))}</email>`;
  const expiresXml = validity.expiresAt === undefined ? '' : `\n      <expiresAt>${escapeText(assertString(validity.expiresAt, 'expiresAt'))}</expiresAt>`;
  const machineValueXml = machine.value === undefined ? '' : `\n      <value>${escapeText(assertString(machine.value, 'machine value'))}</value>`;
  const xml = [
    '<payload>',
    `  <licenseId>${escapeText(assertString(payload.licenseId, 'licenseId'))}</licenseId>`,
    '  <product>',
    `    <id>${escapeText(assertString(product.id, 'product id'))}</id>`,
    `    <version>${escapeText(String(product.version))}</version>`,
    '  </product>',
    `  <type>${escapeText(assertString(payload.type, 'type'))}</type>`,
    '  <customer>',
    `    <id>${escapeText(assertString(customer.id, 'customer id'))}</id>`,
    `    <name>${escapeText(assertString(customer.name, 'customer name'))}</name>${emailXml}`,
    '  </customer>',
    '  <validity>',
    `    <issuedAt>${escapeText(assertString(validity.issuedAt, 'issuedAt'))}</issuedAt>${expiresXml}`,
    '  </validity>',
    '  <features>',
    featureXml,
    '  </features>',
    '  <limits>',
    limitXml,
    '  </limits>',
    '  <machine>',
    `    <type>${escapeText(assertString(machine.type, 'machine type'))}</type>${machineValueXml}`,
    '  </machine>',
    '</payload>',
  ].join('\n');

  const validatedPayload = readPayload(parseDocument(xml).documentElement);
  assert(JSON.stringify(validatedPayload) === JSON.stringify(payloadForComparison(payload)), 'payload values are not in canonical protocol form');
  return xml;
}

function payloadForComparison(payload) {
  const normalized = {
    licenseId: payload.licenseId,
    product: { id: payload.product.id, version: String(payload.product.version) },
    type: payload.type,
    customer: { id: payload.customer.id, name: payload.customer.name },
    validity: { issuedAt: payload.validity.issuedAt },
    features: payload.features.map(({ id, enabled }) => ({ id, enabled })),
    limits: payload.limits.map(({ id, value }) => ({ id, value: String(value) })),
    machine: { type: payload.machine.type },
  };
  if (payload.customer.email !== undefined) normalized.customer.email = payload.customer.email;
  if (payload.validity.expiresAt !== undefined) normalized.validity.expiresAt = payload.validity.expiresAt;
  if (payload.machine.value !== undefined) normalized.machine.value = payload.machine.value;
  return normalized;
}

function readContainer(node, name, expectedNames, { optional = [] } = {}) {
  assert(node.nodeName === name && !node.namespaceURI, `${name} element is invalid`);
  assertAttributes(node, []);
  const children = childElements(node);
  const actualNames = children.map((child) => child.nodeName);
  for (const expected of expectedNames) {
    assert(actualNames.filter((actual) => actual === expected).length === (optional.includes(expected) ? 0 : 1) ||
      (optional.includes(expected) && actualNames.filter((actual) => actual === expected).length <= 1), `invalid ${name}/${expected} element count`);
  }
  const allowed = new Set(expectedNames);
  assert(children.every((child) => allowed.has(child.nodeName)), `unexpected element in ${name}`);
  const required = expectedNames.filter((expected) => !optional.includes(expected));
  assertNames(children, [...required, ...actualNames.filter((actual) => optional.includes(actual))], name);
  return Object.fromEntries(children.map((child) => [child.nodeName, child]));
}

function readLeaf(node, name, attributes = []) {
  const elementName = name.split('/').at(-1);
  assert(node.nodeName === elementName && !node.namespaceURI, `${name} element is invalid`);
  assertAttributes(node, attributes);
  assertNoElementChildren(node, name);
  const value = textContent(node);
  assert(value.length > 0 && value === value.trim(), `${name} must not be empty or have surrounding whitespace`);
  return value;
}

function childElements(node) {
  const elements = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1) {
      elements.push(child);
    } else if (child.nodeType === 3 || child.nodeType === 4) {
      assert(!child.nodeValue.trim(), `unexpected text in ${node.nodeName}`);
    } else {
      assert(child.nodeType === 8, `unexpected XML node in ${node.nodeName}`);
    }
  }
  return elements;
}

function assertNoElementChildren(node, name) {
  for (const child of Array.from(node.childNodes)) {
    assert(child.nodeType === 3 || child.nodeType === 4 || child.nodeType === 8, `${name} must contain text only`);
  }
}

function textContent(node) {
  return Array.from(node.childNodes)
    .filter((child) => child.nodeType === 3 || child.nodeType === 4)
    .map((child) => child.nodeValue)
    .join('');
}

function assertDocumentChildren(document, root) {
  for (const child of Array.from(document.childNodes)) {
    if (child === root || child.nodeType === 8) continue;
    if (child.nodeType === 7 && child.target === 'xml') continue;
    if (child.nodeType === 3 && !String(child.nodeValue || '').trim()) continue;
    assert(false, 'unexpected content outside license root');
  }
}

function assertAttributes(node, expected) {
  const attrs = Array.from(node.attributes || []);
  assert(attrs.every((attr) => !attr.namespaceURI && !attr.name.startsWith('xmlns')), 'namespaces are forbidden');
  const actual = attrs.map((attr) => attr.name);
  assert(actual.length === expected.length && expected.every((name) => actual.includes(name)), `invalid ${node.nodeName} attributes`);
}

function assertNames(actual, expected, context) {
  const names = actual.map((value) => typeof value === 'string' ? value : value.nodeName);
  assert(names.length === expected.length && names.every((name, index) => name === expected[index]), `invalid ${context} structure`);
}

function assertUnique(values, name) {
  assert(new Set(values).size === values.length, `duplicate ${name} id`);
}

function assertValidDate(value, name) {
  assert(DATE_TIME.test(value), `${name} must use YYYY-MM-DDTHH:mm:ssZ`);
  const timestamp = Date.parse(value);
  assert(Number.isFinite(timestamp) && new Date(timestamp).toISOString() === `${value.slice(0, -1)}.000Z`, `${name} is not a valid UTC calendar time`);
}

function assertKeys(value, allowed, name) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  assert(Object.keys(value).every((key) => allowed.includes(key)), `unknown ${name} field`);
}

function assertString(value, name) {
  assert(typeof value === 'string' && isValidXmlString(value), `${name} must be valid XML text`);
  return value;
}

function isValidXmlString(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (!(codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff))) return false;
  }
  return true;
}

function escapeText(value) {
  return assertString(value, 'text').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return assertString(value, 'attribute').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

function getPublicKey(publicKeys, keyId) {
  if (publicKeys instanceof Map) return publicKeys.get(keyId);
  if (publicKeys && typeof publicKeys === 'object') return publicKeys[keyId];
  return undefined;
}

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}
