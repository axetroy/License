# 使用指南

## 安装

```sh
npm install license-xml
```

运行时支持 Node.js 18 及以上版本。

## JavaScript API

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const payload = {
  licenseId: 'LIC-001',
  product: { id: 'my-product', version: '5' },
  type: 'perpetual',
  customer: { id: 'customer-1', name: '示例客户' },
  validity: { issuedAt: '2026-10-20T12:00:00Z' },
  features: [{ id: 'export', enabled: true }],
  limits: [],
  machine: { type: 'none' },
};

const xml = issueLicense(payload, { keyId: 'production-2026', privateKey });
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});
console.log(result.status);
```

`privateKey` 必须只保存在签发系统。生产验证器应使用内置或配置好的可信公钥，不应在运行时生成新密钥对。`verifyLicense` 返回状态，仅在有效时附带解析后的许可证。可通过 `now`（`Date` 或时间戳）设置验证时间，以便进行确定性测试。

## CLI

生成签发密钥：

```sh
npx license-xml keygen --private private.pem --public public.pem
```

签发并验证许可证：

```sh
npx license-xml issue --payload payload.json --private private.pem --key-id production-2026 --out product.license.xml
npx license-xml verify --file product.license.xml --key-id production-2026 --public-key public.pem --product-id my-product --product-version 5
```

CLI 不会覆盖已有文件。请使用操作系统权限保护私钥文件及其备份。验证无效许可证时退出码为 `1`；命令或输入错误时退出码为 `2`。

## 在线体验

打开[浏览器 Playground](./playground)，在本地创建并验证演示许可证。临时密钥仅用于演示，绝不能用于生产签发。
