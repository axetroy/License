---
title: License XML
titleTemplate: 离线许可证格式
description: 使用 Ed25519 签名的、可读且可离线验证的软件许可证格式。
layout: home
hero:
  name: License XML
  text: 随处可验证的离线许可证
  tagline: 使用 Ed25519 与 Canonical XML 1.0 保护的可读 XML 许可证格式。
  actions:
    - theme: brand
      text: 阅读格式标准
      link: /zh-CN/format
    - theme: alt
      text: 打开 Playground
      link: /zh-CN/playground
features:
  - title: 离线验证
    details: 应用使用公钥在本地验证签名，无需许可证服务器。
  - title: 篡改可检测
    details: 使用 Ed25519 对规范化载荷签名，修改受保护数据后签名将失效。
  - title: 可读格式
    details: 许可证使用 UTF-8 XML，并具有明确、严格的结构规范。
---

## 文档导航

- [格式标准](./format)：XML 结构、字段规则与规范化算法。
- [工作原理](./how-it-works)：密钥角色、签发、验证流程与安全边界。
- [使用指南](./guide)：安装 npm 包、调用 API 和使用 CLI。
- [Playground](./playground)：在浏览器中签发和验证演示许可证。
