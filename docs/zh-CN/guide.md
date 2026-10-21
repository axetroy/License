# 使用指南

本指南介绍如何安装 `license-xml`、创建密钥、签发许可证，并在应用中验证许可证。协议字段和完整约束见[协议规范](./specification)。

## 安装

```sh
npm install license-xml
```

运行时需要 Node.js 18 或更高版本。该包是 ESM 模块，可在 `.mjs` 文件或 `"type": "module"` 的项目中导入。

## 快速开始：JavaScript API

以下示例创建一年期订阅许可证，并在本地验证签名、产品和有效期：

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const now = Date.now();
const issuedAt = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .replace(/\.\d{3}Z$/, 'Z');

const payload = {
  licenseId: 'LIC-001',
  product: { id: 'my-product', version: '5' },
  type: 'subscription',
  customer: { id: 'customer-1', name: 'Example Customer' },
  validity: { issuedAt, expiresAt },
  features: [{ id: 'export', enabled: true }],
  limits: [{ id: 'users', value: '50' }],
  machine: { type: 'none' },
};

const xml = issueLicense(payload, {
  keyId: 'production-2026',
  privateKey,
});

const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});

if (result.status === 'VALID') {
  console.log('License ID:', result.license.licenseId);
} else {
  console.error('License rejected:', result.status);
}
```

此示例为便于演示，在同一进程中生成、使用密钥。生产环境应由签发系统安全持有私钥；客户端只配置可信公钥。不要在每次启动或验证时生成新密钥对，否则客户端将无法验证由既有签发密钥产生的许可证。

### 载荷字段

- `licenseId` 是 1～128 个 UTF-8 字节的许可证 ID。
- `product.id` 和 `product.version` 标识许可证适用的产品和主版本。
- `type` 可为 `trial`、`subscription` 或 `perpetual`。前两者必须提供晚于 `issuedAt` 的 `expiresAt`；永久许可证必须省略它。
- `customer.id`、`customer.name` 和 `validity.issuedAt` 必填。时间使用 UTC 的 `YYYY-MM-DDTHH:mm:ssZ` 格式。
- `features` 和 `limits` 是数组；功能 ID 和限制 ID 在各自数组内必须唯一。限制值使用非负整数，建议以字符串提供以避免超大数值的精度损失。
- `machine` 使用 `{ type: 'none' }` 表示不绑定设备；指纹模式还需提供 64 位十六进制 SHA-256 指纹。验证时由集成应用传入指纹，库不会采集设备信息。

## 在应用中验证许可证

验证器通过签名中的 `keyId` 选择可信公钥。生产应用应将公钥随应用安全配置，并传入产品标识：

```js
import { verifyLicense } from 'license-xml';

const result = verifyLicense(licenseXml, {
  publicKeys: new Map([
    ['production-2026', production2026PublicKeyPem],
    ['production-2027', production2027PublicKeyPem],
  ]),
  productId: 'my-product',
  productVersion: '5',
  machineFingerprint: currentMachineFingerprint,
});
```

按需提供 `machineFingerprint`；只有许可证使用机器指纹绑定时才会比较它。验证结果的 `status` 可能是 `VALID`、`INVALID_FORMAT`、`INVALID_SIGNATURE`、`PRODUCT_MISMATCH`、`NOT_YET_VALID`、`EXPIRED` 或 `MACHINE_MISMATCH`。只有 `VALID` 时才会附带解析后的 `license`；应用应检查状态后再使用其中的功能和限制，并自行执行对应授权逻辑。

`verifyLicense` 默认使用当前时间。自动化测试或需要固定验证时点时，可以传入 `now`（`Date` 或时间戳）。许可证到期时间是排他边界：当前时间等于 `expiresAt` 时返回 `EXPIRED`。

## 使用 CLI

CLI 适合手动签发、验证或集成到签发流程。先在受控环境生成一对密钥：

```sh
npx license-xml keygen --private private.pem --public public.pem
```

CLI 以仅所有者可读写的权限创建私钥文件，并且不会覆盖现有文件。请将私钥和备份保存在安全位置，勿提交到版本库或分发给客户端。

创建 `payload.json`：

```json
{
  "licenseId": "LIC-001",
  "product": { "id": "my-product", "version": "5" },
  "type": "perpetual",
  "customer": { "id": "customer-1", "name": "Example Customer" },
  "validity": { "issuedAt": "2020-01-01T00:00:00Z" },
  "features": [{ "id": "export", "enabled": true }],
  "limits": [{ "id": "users", "value": "50" }],
  "machine": { "type": "none" }
}
```

签发和验证：

```sh
npx license-xml issue \
  --payload payload.json \
  --private private.pem \
  --key-id production-2026 \
  --out product.license.xml

npx license-xml verify \
  --file product.license.xml \
  --key-id production-2026 \
  --public-key public.pem \
  --product-id my-product \
  --product-version 5
```

验证成功时输出 `VALID`。产品版本、产品 ID 和机器指纹参数可按需省略；省略产品参数意味着跳过相应的匹配检查。`verify` 对许可证无效返回退出码 `1`，命令或输入错误返回 `2`。CLI 验证命令一次配置一个 `keyId`；需要同时信任多个轮换密钥时，请在 JavaScript API 中传入包含多个条目的 `Map`。

## 安全与部署建议

- 私钥只用于签发，不要放在浏览器、客户端程序、前端构建产物或用户可访问的服务器目录中。
- 将 `keyId` 视为密钥标识而非秘密。轮换时先在验证端部署新公钥，再使用对应 `keyId` 签发；旧许可证仍需保留其公钥，直到不再接受旧密钥。
- 将许可证验证作为应用授权流程的一部分。签名验证成功不代表应用已执行功能开关或用量限制。
- 本格式和库提供离线验证，不提供许可证撤销、在线激活或硬件指纹采集。
- 需要在浏览器中试用时，可打开[在线 Playground](./playground)。Playground 的临时密钥仅供演示。
