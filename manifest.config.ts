import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  description: pkg.description,
  version: pkg.version,
  icons: {
    16: 'public/icons/icon16.png',
    32: 'public/icons/icon32.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_icon: {
      16: 'public/icons/icon16.png',
      32: 'public/icons/icon32.png',
      48: 'public/icons/icon48.png',
      128: 'public/icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'sidePanel',
    'storage',
    'scripting',
    'activeTab',
    'tabs',
  ],
  host_permissions: [
    '<all_urls>',
  ],
  options_page: 'src/options/index.html',
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['http://*/*', 'https://*/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: [{
    resources: ['**/*'],
    matches: ['<all_urls>'],
  }],
})
