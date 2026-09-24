# License XML v1.0

## 软件授权许可文件协议白皮书

**协议名称：** License XML
**协议版本：** 1.0
**文件格式：** XML 1.0
**字符编码：** UTF-8
**签名算法：** Ed25519
**XML 规范化：** XML Canonicalization 1.1
**摘要算法：** SHA-256
**签名编码：** Base64
**设计目标：** 明文可读、可人工编辑、不可伪造、可离线验证

---

# 1. 协议目标

License XML v1.0 定义一种软件授权许可文件格式。

许可证必须满足以下性质：

1. 许可证内容以明文 XML 保存。
2. 用户可以直接打开许可证查看全部授权信息。
3. 用户可以直接编辑 XML。
4. 用户对受保护授权内容进行任何修改后，原签名必须验证失败。
5. 只有授权服务器持有许可证签发私钥。
6. 客户端只持有公钥。
7. 客户端无需访问服务器即可验证许可证签名。
8. 许可证支持有效期、功能权限、数量限制、客户信息和机器绑定。
9. 许可证支持签名密钥轮换。
10. 许可证文件本身不承担保密功能。

---

# 2. 安全模型

License XML v1.0 使用非对称数字签名。

服务器拥有：

```text
Private Key
```

客户端拥有：

```text
Public Key
```

签发过程：

```text
License Payload
       │
       ▼
XML Canonicalization
       │
       ▼
Ed25519 Sign
       │
       ▼
Signature
```

验证过程：

```text
License XML
       │
       ▼
读取 Payload
       │
       ▼
XML Canonicalization
       │
       ▼
Ed25519 Verify
       │
       ▼
Valid / Invalid
```

客户端不得包含许可证签发私钥。

---

# 3. 安全边界

License XML v1.0 保证：

> **签名验证成功时，Payload 内容与签发时的内容一致，并且签名由对应私钥产生。**

License XML v1.0 不保证：

* 用户无法修改客户端程序。
* 用户无法 Patch 客户端。
* 用户无法调试客户端。
* 用户无法修改系统时间。
* 用户无法模拟客户端运行环境。

因此许可证系统保护的是：

```text
License Integrity
```

而不是：

```text
Application Integrity
```

---

# 4. 文件扩展名

许可证文件扩展名固定为：

```text
.license.xml
```

示例：

```text
my-product.license.xml
```

---

# 5. XML 文档结构

许可证根节点固定为：

```xml
<license>
```

完整结构固定为：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<license version="1">

    <payload>

        <licenseId>...</licenseId>

        <product>
            <id>...</id>
            <version>...</version>
        </product>

        <type>...</type>

        <customer>
            <id>...</id>
            <name>...</name>
            <email>...</email>
        </customer>

        <validity>
            <issuedAt>...</issuedAt>
            <expiresAt>...</expiresAt>
        </validity>

        <features>
            ...
        </features>

        <limits>
            ...
        </limits>

        <machine>
            ...
        </machine>

    </payload>

    <signature
        algorithm="Ed25519"
        keyId="...">...</signature>

</license>
```

---

# 6. 根节点

根节点：

```xml
<license version="1">
```

`version` 表示许可证文件协议版本。

v1.0 中：

```text
version = "1"
```

其他值均视为未知协议版本。

---

# 7. Payload

所有授权信息必须位于：

```xml
<payload>
```

节点内部。

Payload 是**完整签名对象**。

以下内容全部属于签名保护范围：

```text
licenseId
product
type
customer
validity
features
limits
machine
```

任何一个字段发生变化，签名验证必须失败。

---

# 8. License ID

结构：

```xml
<licenseId>LIC-20260924-00123</licenseId>
```

License ID 必须：

* 全局唯一
* UTF-8
* 长度 1～128 字节
* 区分大小写

License ID 仅作为许可证唯一标识，不参与授权判断。

---

# 9. Product

产品结构：

```xml
<product>
    <id>my-product</id>
    <version>5</version>
</product>
```

其中：

```text
id
```

表示产品标识。

```text
version
```

表示许可证适用的产品大版本。

例如：

```xml
<product>
    <id>my-editor</id>
    <version>5</version>
</product>
```

表示该许可证授权：

```text
my-editor
```

的：

```text
5.x
```

版本。

---

# 10. License Type

许可证类型：

```xml
<type>trial</type>
```

协议固定支持：

```text
trial
subscription
perpetual
```

含义如下。

### trial

试用许可证。

必须存在：

```xml
<expiresAt>
```

### subscription

订阅许可证。

必须存在：

```xml
<expiresAt>
```

### perpetual

永久许可证。

`expiresAt` 必须省略。

---

# 11. Customer

结构：

```xml
<customer>
    <id>CUSTOMER-001</id>
    <name>Acme Corporation</name>
    <email>admin@example.com</email>
</customer>
```

字段：

| 字段    | 必须 | 含义      |
| ----- | -- | ------- |
| id    | 是  | 客户唯一 ID |
| name  | 是  | 客户名称    |
| email | 否  | 客户邮箱    |

Customer 信息属于签名保护范围。

因此用户修改：

```xml
<name>Acme Corporation</name>
```

为：

```xml
<name>Other Corporation</name>
```

许可证必须验证失败。

---

# 12. Validity

结构：

```xml
<validity>
    <issuedAt>2026-09-24T08:00:00Z</issuedAt>
    <expiresAt>2027-09-24T08:00:00Z</expiresAt>
</validity>
```

所有时间必须使用：

```text
ISO 8601 UTC
```

格式：

```text
YYYY-MM-DDTHH:mm:ssZ
```

例如：

```text
2026-09-24T08:00:00Z
```

---

# 13. Features

功能权限使用：

```xml
<features>

    <feature id="api" enabled="true"/>
    <feature id="export" enabled="true"/>
    <feature id="advanced" enabled="true"/>
    <feature id="sso" enabled="false"/>

</features>
```

Feature ID：

```text
[a-zA-Z0-9._-]
```

功能是否授权由：

```text
enabled
```

决定。

客户端：

```text
enabled="true"
```

表示授权。

```text
enabled="false"
```

表示未授权。

整个 `<features>` 节点属于签名范围。

---

# 14. Limits

数量限制采用：

```xml
<limits>

    <limit id="users">50</limit>

    <limit id="projects">100</limit>

    <limit id="apiRequestsPerMonth">100000</limit>

</limits>
```

`id` 表示限制类型。

元素内容必须是：

```text
非负十进制整数
```

例如：

```xml
<limit id="users">50</limit>
```

表示：

```text
最大用户数 = 50
```

---

# 15. Machine Binding

机器绑定结构：

```xml
<machine>
    <type>fingerprint</type>
    <value>...</value>
</machine>
```

`type` 固定支持：

```text
none
fingerprint
```

当：

```xml
<type>none</type>
```

时：

```xml
<value>
```

必须不存在。

当：

```xml
<type>fingerprint</type>
```

时：

```xml
<value>
```

必须存在。

`value` 保存机器指纹的 SHA-256 十六进制结果：

```text
64 hexadecimal characters
```

例如：

```text
8A71F4D2...
```

---

# 16. Signature

签名结构固定为：

```xml
<signature
    algorithm="Ed25519"
    keyId="production-2026">BASE64_SIGNATURE</signature>
```

其中：

```text
algorithm
```

固定：

```text
Ed25519
```

`keyId` 用于选择验证公钥。

`signature` 元素的文本内容是：

```text
Ed25519 signature
```

经过：

```text
Base64
```

编码后的结果。

---

# 17. Signature 签名范围

签名只针对：

```xml
<payload>
```

节点。

以下节点不参与签名：

```xml
<license>
<signature>
```

签名输入定义为：

```text
CanonicalXML(payload)
```

即：

```text
payload
   ↓
XML Canonicalization 1.1
   ↓
UTF-8 bytes
   ↓
Ed25519.Sign()
```

---

# 18. Signature 验证

客户端执行：

```text
读取 license.xml
        ↓
解析 XML
        ↓
验证协议 version
        ↓
读取 signature.keyId
        ↓
获取对应 Public Key
        ↓
Canonicalize(payload)
        ↓
Base64 Decode(signature)
        ↓
Ed25519 Verify
```

如果验证结果：

```text
false
```

许可证状态必须立即判定：

```text
INVALID_SIGNATURE
```

不得继续执行许可证授权判断。

---

# 19. 密钥体系

每个签名密钥拥有唯一：

```text
keyId
```

例如：

```text
production-2026
production-2027
```

服务器保存：

```text
Private Key
```

客户端保存：

```text
Public Key
```

客户端公钥表：

```text
production-2026 → Public Key A
production-2027 → Public Key B
```

私钥永远不得包含在：

```text
客户端
许可证
安装包
源代码
前端代码
```

中。

---

# 20. 密钥轮换

服务器产生新密钥：

```text
production-2027
```

客户端发布新版本并增加：

```text
production-2027 → Public Key B
```

服务器随后使用：

```text
production-2027
```

签发新许可证。

旧许可证继续使用：

```text
production-2026
```

进行验证。

旧密钥是否继续接受，由客户端版本定义。

---

# 21. XML 注释

XML 允许：

```xml
<!-- License generated by License Server -->
```

注释不属于 Payload 数据。

注释不影响许可证业务内容。

客户端不得根据 XML 注释执行授权逻辑。

---

# 22. XML 格式化

以下 XML：

```xml
<limit id="users">50</limit>
```

和：

```xml
<limit id="users">
    50
</limit>
```

不是同一个 Payload 数据。

因此许可证生成器必须输出规范格式。

Payload 内部不得出现无意义的文本空白。

也就是说，元素：

```xml
<users>50</users>
```

中的：

```text
50
```

就是完整元素值。

---

# 23. 用户修改规则

用户可以修改 XML 文件。

但是：

```text
任何 Payload 字段修改
```

都会导致：

```text
Signature Verification = FAIL
```

例如修改：

```xml
<limit id="users">50</limit>
```

为：

```xml
<limit id="users">5000</limit>
```

结果：

```text
INVALID_SIGNATURE
```

修改：

```xml
<expiresAt>
```

结果：

```text
INVALID_SIGNATURE
```

修改：

```xml
<feature id="enterprise" enabled="false"/>
```

结果：

```text
INVALID_SIGNATURE
```

修改：

```xml
<customer>
```

结果：

```text
INVALID_SIGNATURE
```

---

# 24. 许可证状态

客户端最终只产生以下状态：

```text
VALID
INVALID_FORMAT
INVALID_SIGNATURE
PRODUCT_MISMATCH
NOT_YET_VALID
EXPIRED
MACHINE_MISMATCH
REVOKED
```

状态判断顺序固定：

```text
1. XML Parse
2. Schema Validation
3. Signature Verification
4. Product Validation
5. Time Validation
6. Machine Validation
7. Revocation Validation
8. Feature / Limit Validation
```

---

# 25. 完整许可证示例

最终的许可证文件：

```xml
<?xml version="1.0" encoding="UTF-8"?>

<license version="1">

    <!--
        License XML v1.0
    -->

    <payload>

        <licenseId>LIC-20260924-00123</licenseId>

        <product>
            <id>my-product</id>
            <version>5</version>
        </product>

        <type>subscription</type>

        <customer>
            <id>CUSTOMER-001</id>
            <name>Acme Corporation</name>
            <email>admin@example.com</email>
        </customer>

        <validity>
            <issuedAt>2026-09-24T08:00:00Z</issuedAt>
            <expiresAt>2027-09-24T08:00:00Z</expiresAt>
        </validity>

        <features>

            <feature id="api" enabled="true"/>
            <feature id="export" enabled="true"/>
            <feature id="advanced" enabled="true"/>
            <feature id="sso" enabled="false"/>

        </features>

        <limits>

            <limit id="users">50</limit>
            <limit id="projects">100</limit>
            <limit id="apiRequestsPerMonth">100000</limit>

        </limits>

        <machine>

            <type>fingerprint</type>

            <value>
                8A71F4D2E39F...
            </value>

        </machine>

    </payload>

    <signature
        algorithm="Ed25519"
        keyId="production-2026">V3J0dGVuU2lnbmF0dXJl...</signature>

</license>
```

---

# 26. 签发端

服务器执行：

```text
创建 Payload
       ↓
XML Schema Validation
       ↓
Canonical XML 1.1
       ↓
Ed25519 Private Key
       ↓
Base64
       ↓
生成 Signature
       ↓
生成 license.xml
```

服务器只保存：

```text
Private Key
```

以及许可证数据库。

---

# 27. 客户端

客户端内置：

```text
Public Keys
```

客户端读取：

```text
license.xml
```

然后执行：

```text
Parse
 ↓
Schema validation
 ↓
Canonicalization
 ↓
Ed25519 verification
 ↓
Business validation
```

---

# 28. 许可证数据库

服务器数据库记录：

```text
licenseId
customerId
productId
licenseType
issuedAt
expiresAt
status
keyId
machineFingerprint
```

`status` 固定为：

```text
active
revoked
```

许可证文件本身记录：

```text
active
```

并不代表许可证没有被服务器撤销。

在线模式下，客户端必须查询服务器状态。

---

# 29. 离线许可证

完全离线模式：

```text
license.xml
     ↓
Signature
     ↓
Local validation
```

可以验证：

```text
内容是否被修改
签名是否真实
产品是否匹配
是否过期
机器是否匹配
功能权限
使用限制
```

无法验证：

```text
许可证是否刚刚被服务器撤销
```

因为客户端没有服务器连接。

---

# 30. 在线许可证

在线模式增加：

```text
License Server
```

客户端：

```text
license.xml
      ↓
本地签名验证
      ↓
服务器查询 licenseId
      ↓
检查状态
      ↓
ACTIVE / REVOKED
```

服务器撤销许可证后：

```text
status = revoked
```

客户端下一次成功联网验证时必须拒绝许可证。

---

# 31. 协议的核心安全属性

License XML v1.0 的核心保证可以概括为：

```text
服务器拥有私钥
        ↓
服务器签发 Payload
        ↓
用户可以看到 Payload
        ↓
用户可以修改 Payload
        ↓
但是用户没有私钥
        ↓
无法产生合法的新 Signature
        ↓
修改后的 License 无法通过验证
```

因此：

> **许可证不需要隐藏。许可证的安全性来自签名，而不是来自内容保密。**

---

# 32. 最终协议定义

License XML v1.0 最终固定为：

```text
文件格式       XML 1.0
编码           UTF-8
根节点         license
Payload        payload
签名算法       Ed25519
签名范围       payload
规范化         XML Canonicalization 1.1
签名编码       Base64
密钥标识       keyId
时间格式       ISO 8601 UTC
机器指纹       SHA-256
```

整个协议的核心关系只有一句话：

```text
Signature = Ed25519.Sign(
    PrivateKey,
    CanonicalXML(Payload)
)
```

验证：

```text
Ed25519.Verify(
    PublicKey,
    CanonicalXML(Payload),
    Signature
)
```

**Payload 任何变化都会导致验证失败。**

这份定义可以直接作为 `License XML v1.0` 的协议基础，后续实现时只需要按照这份规范实现签发器和验证器，不需要再对许可证字段和签名机制做二次设计。
