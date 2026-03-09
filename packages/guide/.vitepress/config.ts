import { defineConfig } from 'vitepress';

const koDeveloperSidebar = [
  {
    text: '서비스 개요',
    link: '/ko/developer/introduction',
  },
  {
    text: '시작하기',
    link: '/ko/developer/quick-start',
    items: [
      { text: '빠른 시작', link: '/ko/developer/quick-start' },
      { text: '위젯 연동', link: '/ko/widget/' },
      { text: '주의 사항', link: '/ko/developer/important-notes' },
    ],
  },
  {
    text: '상세 기능',
    link: '/ko/payments/',
    items: [
      { text: '결제', link: '/ko/payments/' },
      { text: '상점', link: '/ko/merchant/' },
      { text: '콜백', link: '/ko/callback/' },
      { text: '웹훅', link: '/ko/webhooks/' },
    ],
  },
];

const enDeveloperSidebar = [
  {
    text: 'Service Overview',
    link: '/en/developer/introduction',
  },
  {
    text: 'Getting Started',
    link: '/en/developer/quick-start',
    items: [
      { text: 'Quick Start', link: '/en/developer/quick-start' },
      { text: 'Widget Integration', link: '/en/widget/' },
      { text: 'Important Notes', link: '/en/developer/important-notes' },
    ],
  },
  {
    text: 'Detailed Features',
    link: '/en/payments/',
    items: [
      { text: 'Payments', link: '/en/payments/' },
      { text: 'Merchant', link: '/en/merchant/' },
      { text: 'Callbacks', link: '/en/callback/' },
      { text: 'Webhooks', link: '/en/webhooks/' },
    ],
  },
];

export default defineConfig({
  title: 'SoloPay',
  description: 'SoloPay Documentation - Blockchain Payment Gateway',

  head: [['link', { rel: 'icon', href: '/solo-pay.svg', type: 'image/svg+xml' }]],

  locales: {
    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [
          { text: '개발자 가이드', link: '/ko/developer/' },
          { text: '유저 가이드', link: '/ko/user/' },
        ],
        sidebar: {
          '/ko/developer/': koDeveloperSidebar,
          '/ko/payments/': koDeveloperSidebar,
          '/ko/gasless/': koDeveloperSidebar,
          '/ko/callback/': koDeveloperSidebar,
          '/ko/webhooks/': koDeveloperSidebar,
          '/ko/widget/': koDeveloperSidebar,
          '/ko/merchant/': koDeveloperSidebar,
          '/ko/sdk/': koDeveloperSidebar,
          '/ko/api/': koDeveloperSidebar,
          '/ko/user/': [
            {
              text: '유저 가이드',
              items: [{ text: '결제 방법', link: '/ko/user/' }],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: '이 페이지',
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Developer Guide', link: '/en/developer/' },
          { text: 'User Guide', link: '/en/user/' },
        ],
        sidebar: {
          '/en/developer/': enDeveloperSidebar,
          '/en/payments/': enDeveloperSidebar,
          '/en/gasless/': enDeveloperSidebar,
          '/en/callback/': enDeveloperSidebar,
          '/en/webhooks/': enDeveloperSidebar,
          '/en/widget/': enDeveloperSidebar,
          '/en/merchant/': enDeveloperSidebar,
          '/en/sdk/': enDeveloperSidebar,
          '/en/api/': enDeveloperSidebar,
          '/en/user/': [
            {
              text: 'User Guide',
              items: [{ text: 'How to Pay', link: '/en/user/' }],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
      },
    },
  },

  themeConfig: {
    logo: { src: '/solo-pay.svg', alt: 'SoloPay' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/supertrust/solo-pay' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'SoloPay Documentation',
      copyright: 'Copyright © 2026 SoloPay',
    },

    darkModeSwitchLabel: '',
    darkModeSwitchTitle: '',
  },
});
