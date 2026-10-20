---
title: Choosing your language
layout: home
---

<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const locale = languages.some((language) => /^zh(?:-|$)/i.test(language)) ? 'zh-CN' : 'en';
  window.location.replace(`${import.meta.env.BASE_URL}${locale}/`);
});
</script>

<div class="language-fallback">
  <p>Redirecting to the documentation in your browser language…</p>
  <p><a href="./en/">Continue in English</a> · <a href="./zh-CN/">简体中文</a></p>
</div>
