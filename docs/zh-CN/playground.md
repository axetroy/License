---
sidebar: false
---

# 浏览器 Playground

Playground 支持编辑许可证载荷、使用临时 Ed25519 密钥签名，并验证或篡改生成的 XML。

<div class="playground-frame">
  <iframe src="/license-xml/playground/" title="License XML 浏览器 Playground" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe>
</div>

签名和验证均在浏览器内完成。私钥只存于当前页面内存，刷新后会丢失。演示密钥绝不能用于真实许可证签发。机器绑定许可证需要集成应用提供指纹；Playground 不会采集设备信息。

Web Crypto Ed25519 需要现代浏览器和安全上下文（HTTPS 或 localhost）。
