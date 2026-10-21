# License XML v1.0

## 软件授权许可文件协议白皮书

**协议名称：** License XML
**协议版本：** 1.0
**文件格式：** XML 1.0
**字符编码：** UTF-8
**签名算法：** Ed25519
**XML 规范化：** Canonical XML 1.0（不含注释）
**摘要算法：** SHA-256（用于机器指纹）
**签名编码：** Base64
**设计目标：** 明文可读、可人工编辑、不可伪造、可离线验证

---

# 1. 协议目标

License XML v1.0 定义一种软件授权许可文件格式。

许可证必须满足以下性质：

1. 许可证内容以明文 XML 保存。
2. 用户可以直接打开许可证查看全部授权信息。
3. 用户可以直接编辑 XML。
4. 用户对改变受保护规范化内容的授权信息进行修改后，原签名必须验证失败。
5. 只有授权服务器持有许可证签发私钥。
6. 客户端只持有公钥。
7. 客户端无需访问服务器即可验证许可证签名。
8. 许可证支持有效期、功能权限、数量限制、客户信息和机器绑定。
9. 许可证支持签名密钥轮换。
10. 许可证文件本身不承担保密功能。
11. 本协议只定义离线许可证格式及签名；撤销服务、硬件指纹采集和使用量计量属于应用层。

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
其子元素必须按第 5 节所示顺序出现；单值元素必须恰好出现一次。允许的可选元素只有 `customer/email` 和按许可证类型决定的 `validity/expiresAt`。

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

任何一个字段的规范化内容发生变化，签名验证必须失败。XML 注释不属于签名内容；属性顺序、引号形式和字符引用等仅改变 XML 词法形式的改动可能不会影响签名。

v1 文档不得使用 XML 命名空间、DTD、外部实体或内部实体声明。不得出现未定义元素、重复的单例元素、重复属性或不符合下文结构的额外内容。解析器必须拒绝 DTD 和实体声明，不得尝试加载外部资源。

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

`id` 必须为 1～128 个 UTF-8 字节。`version` 必须为不带前导零的非负十进制整数。

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

`issuedAt` 必须存在。`expiresAt` 对 `trial` 和 `subscription` 必须存在，对 `perpetual` 必须省略。所有时间必须使用：

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

时间必须是有效日历时间；不接受小数秒、时区偏移或闰秒。`expiresAt` 是排他边界，且必须晚于 `issuedAt`。验证器不得自行添加未在此定义的时钟容差。

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
[a-zA-Z0-9._-]+
```

每个 `feature` 必须且只能有 `id`、`enabled` 两个属性；同一 `<features>` 中的 ID 不得重复。`enabled` 仅接受字符串 `true` 或 `false`。

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

`id` 必须匹配 `[a-zA-Z0-9._-]+`，且在同一 `<limits>` 中唯一。

元素内容必须是：

```text
不带前导零的非负十进制整数（`0` 或 `[1-9][0-9]*`）
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

`value` 是由应用层计算并提供给验证器的机器指纹摘要；协议不规定收集哪些硬件/系统标识或其归一化方式，也不得隐式采集硬件信息。客户端应将其与调用方提供的当前指纹比较，十六进制字母大小写不敏感。此比较规则不改变载荷签名对原始文本的保护。摘要使用 SHA-256 十六进制形式，且必须恰好为 64 个字符：

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

`keyId` 用于选择验证公钥，长度为 1～128 个 ASCII 字符，且仅允许字母、数字、点、下划线和连字符。

`signature` 元素的文本内容是：

```text
Ed25519 signature
```

经过：

```text
Base64
```

编码后的结果。
Ed25519 签名必须恰为 64 字节；Base64 内容不得包含空白。

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
CanonicalXML1.0(payload)
```

规范化算法 URI 固定为 `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`（不含注释）。

即：

```text
payload
   ↓
Canonical XML 1.0（不含注释）
   ↓
UTF-8 bytes
   ↓
Ed25519.Sign()
```

---

# 18. Signature 验证

客户端执行：

```text
读取 product.license.xml
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

元素文本值必须非空，且不得包含前导或尾随空白。客户邮箱是可选的；若出现则必须非空。`feature` 与 `limit` 集合可以为空。

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

Canonical XML 不会删除元素之间的空白文本。元素缩进若被解析为 Payload 内文本节点，就属于签名内容；重新缩进可能导致签名验证失败。注释不参与签名。也就是说，元素：

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
任何改变 Payload 规范化内容的字段修改
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

离线验证器最终只产生以下状态：

```text
VALID
INVALID_FORMAT
INVALID_SIGNATURE
PRODUCT_MISMATCH
NOT_YET_VALID
EXPIRED
MACHINE_MISMATCH
```

`REVOKED` 只能由在线撤销服务返回，不是签名或离线验证状态。本协议未定义撤销 API；无法联网或未集成撤销服务时，验证器不得声称已检查撤销状态。

状态判断顺序固定：

```text
1. XML Parse
2. Schema Validation
3. Signature Verification
4. Product Validation
5. Time Validation
6. Machine Validation
7. 将已签名的 Feature / Limit 数据交由应用层授权逻辑消费
```

XML 解析或结构验证失败时返回 `INVALID_FORMAT`。签名无效、算法不支持或 `keyId` 未知时返回 `INVALID_SIGNATURE`。产品匹配参数可由调用方省略；若提供，则必须全部匹配。过期时间按排他边界判断，即当前时间等于 `expiresAt` 时已过期。

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

            <value>8A71F4D2E39F0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123</value>

        </machine>

    </payload>

    <signature
        algorithm="Ed25519"
        keyId="production-2026">V3J0dGVuU2lnbmF0dXJl...</signature>

</license>
```

**说明：** 示例签名仅用于展示结构，不是可验证的许可证；示例机器指纹也不是特定机器的真实指纹。

---

# 26. 签发端

服务器执行：

```text
创建 Payload
       ↓
结构验证
       ↓
Canonical XML 1.0（不含注释）
       ↓
Ed25519 Private Key
       ↓
Base64
       ↓
生成 Signature
       ↓
生成 product.license.xml
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
product.license.xml
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

以下仅为服务器实现建议，不属于本协议的数据格式或强制服务端行为。若应用提供在线撤销，可自行记录：

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

许可证文件不包含 `active` 状态；签名只能证明许可证内容及签发来源，不能证明其未被撤销。

撤销服务的 API、认证、缓存策略和失败行为均须由应用另行定义。

---

# 29. 离线许可证

完全离线模式：

```text
product.license.xml
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
签名载明的功能权限和数量上限
```

本地验证只读取这些已签名的授权声明；如何强制执行功能开关和计量使用量由应用层负责。机器指纹也必须由调用方提供，不由协议或验证器采集。

无法验证：

```text
许可证是否刚刚被服务器撤销
```

因为客户端没有服务器连接。

---

# 30. 在线许可证

在线许可证系统可以增加自定义撤销服务；以下流程仅为非规范性示意，本协议不定义其接口或在线验证状态：

```text
License Server
```

客户端：

```text
product.license.xml
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

应用定义的在线客户端在撤销服务成功报告 `revoked` 后应拒绝许可证；具体失败和缓存策略由该应用定义。

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
规范化         Canonical XML 1.0（不含注释）
签名编码       Base64
密钥标识       keyId
时间格式       ISO 8601 UTC
机器指纹       SHA-256
```

整个协议的核心关系只有一句话：

```text
Signature = Ed25519.Sign(
    PrivateKey,
    CanonicalXML1.0(Payload)
)
```

验证：

```text
Ed25519.Verify(
    PublicKey,
    CanonicalXML1.0(Payload),
    Signature
)
```

**任何改变 Payload 规范化内容的变化都会导致验证失败。**

这份定义可以直接作为 `License XML v1.0` 的协议基础，后续实现时只需要按照这份规范实现签发器和验证器，不需要再对许可证字段和签名机制做二次设计。
