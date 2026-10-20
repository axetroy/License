# License XML

[简体中文](./README.zh-CN.md) | [English](./README.md)

License XML v1.0 离线软件许可证的 Node.js 实现。协议格式及安全边界详见[设计白皮书](./DESIGN.md)。

## 环境要求

- Node.js 18 或更高版本
- npm
- 开发环境运行 ESLint 10 需要 Node.js 20.19 或更高版本

## 安装与检查

```sh
npm ci
npm run check
```

如需在本地开发并运行 ESLint，请使用 Node.js 20.19 或更高版本。

## 生成密钥并签发许可证

生成 Ed25519 密钥对。私钥应仅保存在签发系统中；客户端只应分发公钥。

```sh
node ./src/cli.js keygen --private private.pem --public public.pem
```

准备 UTF-8 编码的 JSON 授权载荷：

```json
{
  "licenseId": "LIC-20260924-00123",
  "product": { "id": "my-product", "version": "5" },
  "type": "subscription",
  "customer": { "id": "CUSTOMER-001", "name": "Acme Corporation" },
  "validity": {
    "issuedAt": "2026-09-24T08:00:00Z",
    "expiresAt": "2027-09-24T08:00:00Z"
  },
  "features": [{ "id": "export", "enabled": true }],
  "limits": [{ "id": "users", "value": "50" }],
  "machine": { "type": "none" }
}
```

使用私钥签发许可证。若输出文件已存在，命令会失败，不会覆盖原文件。

```sh
node ./src/cli.js issue \
  --payload payload.json \
  --private private.pem \
  --key-id production-2026 \
  --out my-product.license.xml
```

## 验证许可证

验证时提供与许可证 `keyId` 对应的公钥：

```sh
node ./src/cli.js verify \
  --file my-product.license.xml \
  --key-id production-2026 \
  --public-key public.pem \
  --product-id my-product \
  --product-version 5
```

验证器会输出[白皮书定义的状态](./DESIGN.md)，验证失败时退出码为 `1`，命令或输入错误时退出码为 `2`。机器绑定许可证需要使用 `--machine-fingerprint` 传入应用计算的 64 位 SHA-256 十六进制摘要。

## JavaScript API

```js
import { generateKeyPair, issueLicense, verifyLicense } from 'license-xml';

const { privateKey, publicKey } = generateKeyPair();
const xml = issueLicense(payload, { keyId: 'production-2026', privateKey });
const result = verifyLicense(xml, {
  publicKeys: new Map([['production-2026', publicKey]]),
  productId: 'my-product',
  productVersion: '5',
});
```

`issueLicense(payload, { keyId, privateKey })` 返回签名后的 XML 字符串。`verifyLicense(xml, options)` 返回 `{ status, license? }`。可以通过 `now`（`Date` 或时间戳）指定验证时间，便于编写确定性测试。

验证器拒绝 DTD/实体声明、XML 命名空间、未知元素、重复标识符、格式错误的签名以及超过 1 MiB 的许可证文件。

## 工程化与 CI

- `npm run lint`：使用 ESLint 检查代码。
- `npm test`：使用 Node.js 内置测试运行器执行单元测试和 CLI 集成测试。
- `npm run check`：依次运行 lint、测试并构建浏览器 Playground。
- GitHub Actions 会在推送和 Pull Request 时，在 Node.js 18、20、22、24 上执行测试；在 Node.js 20、22、24 上执行 lint、测试和 Playground 构建。

CLI 和核心库直接运行原生 ESM JavaScript；浏览器 Playground 使用 esbuild 打包为静态文件。

## 自动发布到 npm

`.github/workflows/publish.yml` 会在 GitHub Release 发布后，通过 npm trusted publishing（OIDC）发布到 npm，无需 npm access token。首次发布前，请在 npmjs.com 对应包的 **Trusted Publisher** 设置中，将发布方配置为当前 GitHub 仓库和工作流文件 `.github/workflows/publish.yml`。无需设置 `NPM_TOKEN` Secret。

发布步骤：先更新 `package.json` 和 `package-lock.json` 中的版本并提交，再推送匹配的 `vX.Y.Z` 标签，并为该标签创建、发布 GitHub Release。工作流会核对 Release 标签与包版本，然后执行 `npm ci`、`npm run check`，最后发布带 provenance 证明的 npm 包。

## 浏览器 Playground

浏览器 Playground 地址为 `https://axetroy.github.io/License/`。你可以编辑授权载荷，使用浏览器内存中的临时 Ed25519 密钥签名，并验证或篡改生成的 XML。许可证和密钥操作均在本地浏览器完成，不会上传到服务器。演示私钥不会持久化，严禁用于生产许可证签发。

Pages 工作流会在推送到 `main` 或 `master` 分支时构建并部署静态页面。首次部署前，请在仓库 **Settings → Pages → Build and deployment → GitHub Actions** 中启用 GitHub Actions 部署。运行 `npm run build:playground` 可在本地构建到 `dist/` 目录。

## 安全边界

- 签名和验证使用 Node.js 内置 Ed25519 密码学能力及不含注释的 Canonical XML 1.0。
- 本项目不保存私钥、不提供许可证服务器或在线撤销接口、不采集硬件信息，也不负责在应用中强制执行功能权限和用量限制。
- 机器指纹采集和许可证撤销属于应用层集成；离线验证无法获知服务器端刚刚发生的撤销。
- 有效签名证明载荷由对应私钥持有者签发，但无法阻止攻击者 Patch 客户端程序或修改系统时间。
