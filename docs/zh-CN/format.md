# License XML v1.0 格式标准

License XML 是 UTF-8 编码的 XML 1.0 文档。使用 Canonical XML 1.0（不含注释）规范化载荷后，再使用 Ed25519 签名。

## 文档结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<license version="1">
  <payload>
    <licenseId>LIC-20261020-001</licenseId>
    <product>
      <id>my-product</id>
      <version>5</version>
    </product>
    <type>subscription</type>
    <customer>
      <id>CUSTOMER-001</id>
      <name>示例客户</name>
      <email>customer@example.com</email>
    </customer>
    <validity>
      <issuedAt>2026-10-20T12:00:00Z</issuedAt>
      <expiresAt>2027-10-20T12:00:00Z</expiresAt>
    </validity>
    <features>
      <feature id="export" enabled="true"/>
    </features>
    <limits>
      <limit id="users">50</limit>
    </limits>
    <machine>
      <type>none</type>
    </machine>
  </payload>
  <signature algorithm="Ed25519" keyId="production-2026">BASE64_SIGNATURE</signature>
</license>
```

根节点必须依次包含且仅包含一个 `payload` 和一个 `signature`。`payload` 子元素顺序固定为：`licenseId`、`product`、`type`、`customer`、`validity`、`features`、`limits`、`machine`。不允许 XML 命名空间、DTD、实体声明、未知元素或未知属性。

## 字段及约束

| 字段 | 含义与规则 |
| --- | --- |
| `licenseId` | 非空许可证标识符，最多 128 个 UTF-8 字节。 |
| `product/id` | 非空产品标识符，最多 128 个 UTF-8 字节。 |
| `product/version` | 非负十进制整数，不允许前导零（`0` 除外）。 |
| `type` | `trial`、`subscription` 或 `perpetual`。 |
| `customer/id`、`customer/name` | 必填且非空；`email` 可选。 |
| `validity/issuedAt` | 必填 UTC 时间，格式为 `YYYY-MM-DDTHH:mm:ssZ`。 |
| `validity/expiresAt` | 非永久许可证必填；若存在，必须晚于 `issuedAt`。 |
| `features/feature` | `id` 唯一，且必须有 `enabled="true"` 或 `enabled="false"`。 |
| `limits/limit` | `id` 唯一，值为非负十进制整数。 |
| `machine/type` | `none` 或 `fingerprint`；指纹模式要求 `machine/value` 恰好是 64 个表示 SHA-256 摘要的十六进制字符。 |
| `signature` | 64 字节 Ed25519 签名，以标准 Base64 编码；`keyId` 用于定位可信公钥。 |

永久许可证省略 `expiresAt`。机器指纹的采集和计算由应用负责，协议不规定硬件标识符。验证许可证时，指纹十六进制字符比较不区分字母大小写；但签名保护的 XML 原始载荷文本仍区分大小写。

## 规范化

仅对 `<payload>` 元素签名。签发方与验证方使用 Canonical XML 1.0（不含注释）规范化该元素，并将结果编码为 UTF-8 后进行 Ed25519 签名或验证。文本中的空白属于签名内容，不能随意重排。规范性完整定义见[License XML v1.0 协议规范](./specification)。
