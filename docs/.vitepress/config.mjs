import { defineConfig } from 'vitepress';

const englishNav = [
  { text: 'Format', link: '/en/format' },
  { text: 'How it works', link: '/en/how-it-works' },
  { text: 'Guide', link: '/en/guide' },
  { text: 'Playground', link: '/en/playground' },
  {
    text: 'Language',
    items: [
      { text: 'English', link: '/en/' },
      { text: '简体中文', link: '/zh-CN/' },
    ],
  },
];

const chineseNav = [
  { text: '格式标准', link: '/zh-CN/format' },
  { text: '工作原理', link: '/zh-CN/how-it-works' },
  { text: '使用指南', link: '/zh-CN/guide' },
  { text: '在线体验', link: '/zh-CN/playground' },
  {
    text: '语言',
    items: [
      { text: 'English', link: '/en/' },
      { text: '简体中文', link: '/zh-CN/' },
    ],
  },
];

export default defineConfig({
  title: 'License XML',
  description: 'An offline XML license format with Ed25519 signatures',
  lang: 'en-US',
  base: '/License/',
  outDir: '../dist',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo.svg', alt: 'License XML' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/axetroy/License' }],
    nav: englishNav,
    sidebar: {
      '/en/': [
        {
          text: 'Documentation',
          items: [
            { text: 'Overview', link: '/en/' },
            { text: 'Format standard', link: '/en/format' },
            { text: 'How it works', link: '/en/how-it-works' },
            { text: 'Usage guide', link: '/en/guide' },
            { text: 'Playground', link: '/en/playground' },
          ],
        },
      ],
      '/zh-CN/': [
        {
          text: '文档',
          items: [
            { text: '概览', link: '/zh-CN/' },
            { text: '格式标准', link: '/zh-CN/format' },
            { text: '工作原理', link: '/zh-CN/how-it-works' },
            { text: '使用指南', link: '/zh-CN/guide' },
            { text: 'Playground', link: '/zh-CN/playground' },
          ],
        },
      ],
    },
    locales: {
      '/zh-CN/': {
        label: '简体中文',
        lang: 'zh-CN',
        themeConfig: {
          nav: chineseNav,
          outlineTitle: '本页目录',
          lastUpdated: { text: '最后更新于' },
          docFooter: { prev: '上一页', next: '下一页' },
          returnToTopLabel: '返回顶部',
          sidebarMenuLabel: '菜单',
          darkModeSwitchLabel: '外观',
          lightModeSwitchTitle: '浅色模式',
          darkModeSwitchTitle: '深色模式',
        },
      },
    },
  },
});
