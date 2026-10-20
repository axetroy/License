import { XmlCanonicalizer } from 'xmldsigjs';

const examplePayload = {
  licenseId: 'LIC-DEMO-001',
  product: { id: 'my-product', version: '5' },
  type: 'subscription',
  customer: { id: 'DEMO-CUSTOMER', name: '示例客户', email: 'demo@example.com' },
  validity: {
    issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  },
  features: [{ id: 'export', enabled: true }, { id: 'sso', enabled: false }],
  limits: [{ id: 'users', value: '50' }],
  machine: { type: 'none' },
};

const encoder = new TextEncoder();
const payloadField = document.querySelector('#payload');
const publicKeyField = document.querySelector('#public-key');
const licenseField = document.querySelector('#license');
const resultField = document.querySelector('#result');
const signButton = document.querySelector('#sign');
const verifyButton = document.querySelector('#verify');
const copyButton = document.querySelector('#copy-key');
let demoPrivateKey;

payloadField.value = JSON.stringify(examplePayload, null, 2);

document.querySelector('#reset').addEventListener('click', () => {
  payloadField.value = JSON.stringify(examplePayload, null, 2);
  licenseField.value = '';
  demoPrivateKey = undefined;
  publicKeyField.value = '';
  copyButton.disabled = true;
  showResult('等待验证', '签名结果会显示在这里。');
});

signButton.addEventListener('click', async () => {
  signButton.disabled = true;
  licenseField.value = '';
  publicKeyField.value = '';
  demoPrivateKey = undefined;
  copyButton.disabled = true;
  try {
    ensureEd25519();
    const payload = validatePayload(JSON.parse(payloadField.value));
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    demoPrivateKey = keyPair.privateKey;
    const publicDer = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
    publicKeyField.value = toPem(publicDer, 'PUBLIC KEY');
    copyButton.disabled = false;

    const payloadXml = serializePayload(payload);
    const payloadNode = parseXml(payloadXml).documentElement;
    const canonicalPayload = canonicalize(payloadNode);
    const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', demoPrivateKey, encoder.encode(canonicalPayload)));
    licenseField.value = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<license version="1">',
      payloadXml,
      `  <signature algorithm="Ed25519" keyId="playground-demo">${toBase64(signature)}</signature>`,
      '</license>',
      '',
    ].join('\n');
    showResult('许可证已签名', '演示密钥只存在于当前页面内存中；请验证后尝试篡改载荷。', true);
  } catch (error) {
    showResult('无法签名', error.message);
  } finally {
    signButton.disabled = false;
  }
});

verifyButton.addEventListener('click', async () => {
  verifyButton.disabled = true;
  try {
    ensureEd25519();
    const parsed = parseLicense(licenseField.value);
    const publicKey = await crypto.subtle.importKey('spki', fromPem(publicKeyField.value, 'PUBLIC KEY'), { name: 'Ed25519' }, false, ['verify']);
    const valid = await crypto.subtle.verify('Ed25519', publicKey, parsed.signature, encoder.encode(parsed.canonicalPayload));
    if (!valid) {
      showResult('签名无效', '签名与载荷不匹配，许可证内容可能被修改。');
      return;
    }

    validateValidity(parsed.payload);
    if (parsed.payload.machine.type === 'fingerprint') {
      throw new Error('机器绑定许可证需由集成应用提供实际机器指纹；本演示不采集设备信息。');
    }
    showResult('签名有效', `签名验证通过。许可证 ID：${parsed.payload.licenseId}，产品：${parsed.payload.product.id}。`, true);
  } catch (error) {
    showResult('验证失败', error.message);
  } finally {
    verifyButton.disabled = false;
  }
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(publicKeyField.value);
    copyButton.textContent = '已复制';
    setTimeout(() => { copyButton.textContent = '复制'; }, 1500);
  } catch {
    publicKeyField.focus();
    publicKeyField.select();
  }
});

function ensureEd25519() {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持 Web Crypto，请使用 HTTPS 或 localhost 打开页面。');
}

function validatePayload(payload) {
  const keys = ['licenseId', 'product', 'type', 'customer', 'validity', 'features', 'limits', 'machine'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some((key) => !keys.includes(key))) {
    throw new Error('载荷必须是符合协议结构的 JSON 对象。');
  }
  if (!['trial', 'subscription', 'perpetual'].includes(payload.type)) throw new Error('type 必须是 trial、subscription 或 perpetual。');
  if (!payload.product || !payload.customer || !payload.validity || !payload.machine || !Array.isArray(payload.features) || !Array.isArray(payload.limits)) {
    throw new Error('载荷缺少 product、customer、validity、machine、features 或 limits。');
  }
  const licenseId = requiredText(payload.licenseId, 'licenseId');
  if (encoder.encode(licenseId).length > 128) throw new Error('licenseId 最长为 128 个 UTF-8 字节。');
  const productId = requiredText(payload.product.id, 'product.id');
  if (encoder.encode(productId).length > 128) throw new Error('product.id 最长为 128 个 UTF-8 字节。');
  const productVersion = String(payload.product.version);
  if (!/^(0|[1-9]\d*)$/.test(productVersion)) throw new Error('product.version 必须为不带前导零的非负整数。');

  const customer = {
    id: requiredText(payload.customer.id, 'customer.id'),
    name: requiredText(payload.customer.name, 'customer.name'),
  };
  if (payload.customer.email !== undefined) customer.email = requiredText(payload.customer.email, 'customer.email');

  const validity = { issuedAt: requiredText(payload.validity.issuedAt, 'validity.issuedAt') };
  validateDate(validity.issuedAt, 'issuedAt');
  if (payload.type === 'perpetual') {
    if (payload.validity.expiresAt !== undefined) throw new Error('perpetual 许可证必须省略 expiresAt。');
  } else {
    validity.expiresAt = requiredText(payload.validity.expiresAt, 'validity.expiresAt');
    validateDate(validity.expiresAt, 'expiresAt');
    if (Date.parse(validity.expiresAt) <= Date.parse(validity.issuedAt)) throw new Error('expiresAt 必须晚于 issuedAt。');
  }

  const features = payload.features.map((feature) => {
    if (!feature || !/^[a-zA-Z0-9._-]+$/.test(feature.id) || typeof feature.enabled !== 'boolean' || Object.keys(feature).some((key) => !['id', 'enabled'].includes(key))) {
      throw new Error('feature 必须包含合法 id 和布尔值 enabled。');
    }
    return { id: feature.id, enabled: feature.enabled };
  });
  assertUnique(features.map(({ id }) => id), 'feature');

  const limits = payload.limits.map((limit) => {
    const value = String(limit?.value);
    if (!limit || !/^[a-zA-Z0-9._-]+$/.test(limit.id) || !/^(0|[1-9]\d*)$/.test(value) || Object.keys(limit).some((key) => !['id', 'value'].includes(key))) {
      throw new Error('limit 必须包含合法 id 和非负十进制整数 value。');
    }
    return { id: limit.id, value };
  });
  assertUnique(limits.map(({ id }) => id), 'limit');

  const machine = { type: payload.machine.type };
  if (machine.type === 'fingerprint') {
    machine.value = requiredText(payload.machine.value, 'machine.value');
    if (!/^[a-fA-F0-9]{64}$/.test(machine.value)) throw new Error('machine.value 必须为 64 位十六进制摘要。');
  } else if (machine.type !== 'none' || payload.machine.value !== undefined) {
    throw new Error('machine.type 必须为 none 或 fingerprint，且 none 不允许 value。');
  }

  return {
    licenseId,
    product: { id: productId, version: productVersion },
    type: payload.type,
    customer,
    validity,
    features,
    limits,
    machine,
  };
}

function parseLicense(xml) {
  if (typeof xml !== 'string' || encoder.encode(xml).length > 1024 * 1024 || /<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new Error('许可证为空、超过 1 MiB 或包含禁止的 DTD/实体声明。');
  }
  const declaration = /^\s*<\?xml\b([^?]*)\?>/.exec(xml);
  if (declaration) {
    const version = /\bversion\s*=\s*(['"])([^'"]+)\1/.exec(declaration[1]);
    const encoding = /\bencoding\s*=\s*(['"])([^'"]+)\1/i.exec(declaration[1]);
    if (version?.[2] !== '1.0' || (encoding && encoding[2].toUpperCase() !== 'UTF-8')) {
      throw new Error('XML 声明必须使用 XML 1.0 和 UTF-8。');
    }
  }
  const document = parseXml(xml);
  const root = document.documentElement;
  assertAttributes(root, ['version']);
  if (root.nodeName !== 'license' || root.namespaceURI || root.getAttribute('version') !== '1') {
    throw new Error('根元素必须是无命名空间的 <license version="1">。');
  }
  const rootChildren = elementChildren(root, ['payload', 'signature'], [], ['version']);
  if (rootChildren.length !== 2 || rootChildren[0].nodeName !== 'payload' || rootChildren[1].nodeName !== 'signature') {
    throw new Error('license 必须依次包含 payload 和 signature。');
  }
  const payloadNode = rootChildren[0];
  assertAttributes(payloadNode, []);
  const payloadChildren = elementChildren(payloadNode, ['licenseId', 'product', 'type', 'customer', 'validity', 'features', 'limits', 'machine']);
  if (payloadChildren.length !== 8) throw new Error('payload 结构不符合 License XML v1.0。');
  const fields = Object.fromEntries(payloadChildren.map((node) => [node.nodeName, node]));
  const productFields = elementChildren(fields.product, ['id', 'version']);
  const customerFields = elementChildren(fields.customer, ['id', 'name', 'email'], ['email']);
  const validityFields = elementChildren(fields.validity, ['issuedAt', 'expiresAt'], ['expiresAt']);
  const machineFields = elementChildren(fields.machine, ['type', 'value'], ['value']);
  const type = leafText(fields.type);
  if (productFields.length !== 2 || customerFields.length < 2 || customerFields.length > 3 || validityFields.length < 1 || validityFields.length > 2 || machineFields.length < 1 || machineFields.length > 2) {
    throw new Error('payload 子元素结构错误。');
  }
  const customer = { id: leafText(customerFields[0]), name: leafText(customerFields[1]) };
  if (customerFields[2]) customer.email = leafText(customerFields[2]);
  const validity = { issuedAt: leafText(validityFields[0]) };
  if (validityFields[1]) validity.expiresAt = leafText(validityFields[1]);
  const features = elementChildren(fields.features, null).map((node) => {
    assertAttributes(node, ['id', 'enabled']);
    if (node.nodeName !== 'feature' || (node.getAttribute('enabled') !== 'true' && node.getAttribute('enabled') !== 'false')) {
      throw new Error('features 包含格式错误的 feature。');
    }
    if ([...node.children].length || node.textContent.trim()) throw new Error('feature 必须是空元素。');
    return { id: node.getAttribute('id'), enabled: node.getAttribute('enabled') === 'true' };
  });
  const limits = elementChildren(fields.limits, null).map((node) => {
    assertAttributes(node, ['id']);
    if (node.nodeName !== 'limit') throw new Error('limits 包含格式错误的 limit。');
    return { id: node.getAttribute('id'), value: leafText(node, ['id']) };
  });
  const machine = { type: leafText(machineFields[0]) };
  if (machineFields.length === 2 && machineFields[1].nodeName !== 'value') throw new Error('machine/value 必须位于 machine/type 之后。');
  if (machineFields[1]) machine.value = leafText(machineFields[1]);
  const payload = validatePayload({
    licenseId: leafText(fields.licenseId),
    product: { id: leafText(productFields[0]), version: leafText(productFields[1]) },
    type,
    customer,
    validity,
    features,
    limits,
    machine,
  });
  const signatureNode = rootChildren[1];
  assertAttributes(signatureNode, ['algorithm', 'keyId']);
  if (signatureNode.getAttribute('algorithm') !== 'Ed25519' || !/^[a-zA-Z0-9._-]{1,128}$/.test(signatureNode.getAttribute('keyId'))) {
    throw new Error('signature 算法或 keyId 格式错误。');
  }
  const signatureText = leafText(signatureNode, ['algorithm', 'keyId']);
  const signature = fromBase64(signatureText);
  if (signature.length !== 64 || toBase64(signature) !== signatureText) throw new Error('Ed25519 签名必须是 64 字节的标准 Base64。');
  return { payload, signature, canonicalPayload: canonicalize(payloadNode) };
}

function validateValidity(payload) {
  const now = Date.now();
  if (now < Date.parse(payload.validity.issuedAt)) throw new Error('许可证尚未生效（NOT_YET_VALID）。');
  if (payload.validity.expiresAt && now >= Date.parse(payload.validity.expiresAt)) throw new Error('许可证已过期（EXPIRED）。');
}

function serializePayload(payload) {
  const xml = [
    '<payload>',
    `  <licenseId>${escapeText(payload.licenseId)}</licenseId>`,
    '  <product>',
    `    <id>${escapeText(payload.product.id)}</id>`,
    `    <version>${escapeText(payload.product.version)}</version>`,
    '  </product>',
    `  <type>${escapeText(payload.type)}</type>`,
    '  <customer>',
    `    <id>${escapeText(payload.customer.id)}</id>`,
    `    <name>${escapeText(payload.customer.name)}</name>`,
    ...(payload.customer.email === undefined ? [] : [`    <email>${escapeText(payload.customer.email)}</email>`]),
    '  </customer>',
    '  <validity>',
    `    <issuedAt>${escapeText(payload.validity.issuedAt)}</issuedAt>`,
    ...(payload.validity.expiresAt === undefined ? [] : [`    <expiresAt>${escapeText(payload.validity.expiresAt)}</expiresAt>`]),
    '  </validity>',
    '  <features>',
    ...payload.features.map(({ id, enabled }) => `    <feature id="${escapeAttribute(id)}" enabled="${enabled}"/>`),
    '  </features>',
    '  <limits>',
    ...payload.limits.map(({ id, value }) => `    <limit id="${escapeAttribute(id)}">${escapeText(value)}</limit>`),
    '  </limits>',
    '  <machine>',
    `    <type>${escapeText(payload.machine.type)}</type>`,
    ...(payload.machine.value === undefined ? [] : [`    <value>${escapeText(payload.machine.value)}</value>`]),
    '  </machine>',
    '</payload>',
  ].join('\n');
  if (encoder.encode(xml).length > 1024 * 1024) throw new Error('许可证载荷超过 1 MiB。');
  return xml;
}

function parseXml(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || !document.documentElement) throw new Error('XML 格式错误。');
  return document;
}

function canonicalize(node) {
  return new XmlCanonicalizer(false, false).Canonicalize(node);
}

function elementChildren(node, expected, optional = [], attributes = []) {
  assertAttributes(node, attributes);
  for (const child of node.childNodes) {
    if (child.nodeType === 3 || child.nodeType === 4) {
      if (child.nodeValue.trim()) throw new Error(`${node.nodeName} 中存在意外文本。`);
    } else if (child.nodeType !== 1 && child.nodeType !== 8) {
      throw new Error(`${node.nodeName} 中存在不支持的 XML 内容。`);
    }
  }
  const elements = [...node.children];
  if (expected && elements.some((element) => element.namespaceURI || !expected.includes(element.nodeName))) {
    throw new Error(`${node.nodeName} 包含未知或带命名空间的元素。`);
  }
  if (expected) {
    const names = elements.map((element) => element.nodeName);
    const orderedExpected = expected.filter((name) => names.includes(name));
    if (names.length !== new Set(names).size || names.some((name, index) => name !== orderedExpected[index]) ||
      expected.some((name) => !optional.includes(name) && !names.includes(name))) {
      throw new Error(`${node.nodeName} 包含缺失、重复或顺序错误的元素。`);
    }
  }
  for (const element of elements) {
    if ([...element.attributes].some((attribute) => attribute.namespaceURI || attribute.name.startsWith('xmlns'))) {
      throw new Error('License XML v1.0 不允许 XML 命名空间。');
    }
  }
  return elements;
}

function leafText(node, attributes = []) {
  assertAttributes(node, attributes);
  if ([...node.children].length) {
    throw new Error(`${node.nodeName} 必须是无属性的文本元素。`);
  }
  const value = node.textContent;
  if (!value || value !== value.trim()) throw new Error(`${node.nodeName} 不得为空或包含首尾空白。`);
  return value;
}

function assertAttributes(node, expected) {
  const actual = [...node.attributes].map((attribute) => attribute.name);
  if ([...node.attributes].some((attribute) => attribute.namespaceURI || attribute.name.startsWith('xmlns')) ||
    actual.length !== expected.length || expected.some((name) => !actual.includes(name))) {
    throw new Error(`${node.nodeName} 属性不符合 License XML v1.0。`);
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || !value || value !== value.trim() || !isXmlText(value)) {
    throw new Error(`${name} 必须是非空且无首尾空白的文本。`);
  }
  return value;
}

function isXmlText(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (!(codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff))) return false;
  }
  return true;
}

function validateDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== `${value.slice(0, -1)}.000Z`) {
    throw new Error(`${name} 必须是有效的 YYYY-MM-DDTHH:mm:ssZ 时间。`);
  }
}

function assertUnique(values, name) {
  if (new Set(values).size !== values.length) throw new Error(`${name} ID 不得重复。`);
}

function escapeText(value) {
  return requiredText(value, 'XML 文本').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return requiredText(value, 'XML 属性').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('签名必须是标准 Base64。');
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toPem(bytes, label) {
  const base64 = toBase64(bytes).match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function fromPem(pem, label) {
  const match = new RegExp(`^-----BEGIN ${label}-----\\s+([A-Za-z0-9+/=\\s]+)\\s+-----END ${label}-----$`).exec(pem.trim());
  if (!match) throw new Error('公钥必须是有效的 SPKI PEM 格式。');
  return fromBase64(match[1].replace(/\s/g, ''));
}

function showResult(title, message, success = false) {
  resultField.className = `result ${success ? 'result-success' : 'result-error'}`;
  resultField.replaceChildren();
  const indicator = document.createElement('span');
  indicator.className = 'result-indicator';
  const content = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const description = document.createElement('p');
  description.textContent = message;
  content.append(heading, description);
  resultField.append(indicator, content);
}
