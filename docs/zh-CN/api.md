---
sidebar: false
---

# API 参考

`license-xml` 提供 Ed25519 密钥生成、许可证签发、XML 解析和许可证验证接口。

```js
import {
  LicenseStatus,
  generateKeyPair,
  issueLicense,
  parseLicense,
  verifyLicense,
} from 'license-xml';
```

## `generateKeyPair()`

返回 PEM 编码的 Ed25519 密钥对：

```js
{
  privateKey: string, // PKCS#8 PEM；必须保密
  publicKey: string,  // SPKI PEM；提供给验证端
}
```

应在受控的密钥管理或签发环境中调用。不要在客户端应用里生成新密钥来替代配置签发方的可信公钥。

## `issueLicense(payload, options)`

校验许可证载荷，使用 Ed25519 对规范化 XML 签名，并返回完整的许可证 XML 字符串。

```js
const xml = issueLicense(payload, {
  keyId: 'production-2026',
  privateKey,
});
```

`options` 必须包含：

| 选项 | 类型 | 说明 |
| --- | --- | --- |
| `keyId` | `string` | 1～128 个字母、数字、点、下划线或连字符，用于标识签名密钥。 |
| `privateKey` | `string \| Buffer` | PEM 格式的 Ed25519 私钥。 |

载荷字段及校验规则详见[协议规范](./specification)。选项或载荷无效时会抛出 `Error`。生成的 XML 最大为 1 MiB。

## `parseLicense(xml)`

解析并校验许可证 XML，但不验证签名：

```js
const parsed = parseLicense(xml);
// { payload, algorithm, keyId, signature, canonicalPayload }
```

其中 `signature` 是 `Buffer`，其余字段为字符串或解析后的载荷数据。XML 结构无效或不受支持时会抛出 `Error`。仅完成解析**不能**证明许可证可信；信任其授权内容前应调用 `verifyLicense`。

## `verifyLicense(xml, options?)`

检查许可证格式和签名，然后执行可选的产品、时间及机器指纹检查。对于无效许可证，此函数返回结果对象而不是抛出异常：

```js
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKeyPem]]),
  productId: 'my-product',
  productVersion: '5',
});

if (result.status === LicenseStatus.VALID) {
  console.log(result.license);
}
```

| 选项 | 类型 | 说明 |
| --- | --- | --- |
| `publicKeys` | `Map<string, string \| Buffer> \| object` | 以 `keyId` 为索引的可信公钥。验证签名需要匹配的公钥。 |
| `productId` | `string` | 提供时要求产品 ID 完全匹配。 |
| `productVersion` | `string \| number` | 提供时要求产品版本完全匹配。 |
| `now` | `Date \| number \| string` | 验证时刻；默认为当前时间。 |
| `machineFingerprint` | `string` | 机器绑定许可证所需的当前 SHA-256 十六进制指纹，长度为 64 个字符。 |

验证失败时返回 `{ status }`；成功时返回 `{ status: 'VALID', license }`。只有状态为 `VALID` 时才能使用载荷数据。功能与数量限制仍需由应用层实际执行。

## `LicenseStatus`

`LicenseStatus` 是冻结对象，包含所有可能的 `status` 值：

| 值 | 含义 |
| --- | --- |
| `VALID` | 格式、签名和调用方要求的检查均通过。 |
| `INVALID_FORMAT` | XML、载荷、签名编码或验证时间无效。 |
| `INVALID_SIGNATURE` | 签名无效、算法不支持或缺少匹配的可信公钥。 |
| `PRODUCT_MISMATCH` | 提供的产品 ID 或版本与许可证不匹配。 |
| `NOT_YET_VALID` | 当前验证时间早于 `issuedAt`。 |
| `EXPIRED` | 当前验证时间已到或晚于 `expiresAt`。 |
| `MACHINE_MISMATCH` | 缺少机器指纹、格式错误或指纹不匹配。 |

相关内容：[使用指南](./guide)提供完整操作示例，[工作原理](./how-it-works)介绍签发与验证流程。
