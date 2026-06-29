import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist-extension';

const manifest = {
  manifest_version: 3,
  name: 'RunBeat',
  version: '1.0.0',
  description: '跑步节奏训练器：节拍、步频、音乐同步和实时运动数据。',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'Open RunBeat',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  background: {
    service_worker: 'background.js',
  },
};

const background = `
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
`.trimStart();

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(outDir, 'background.js'), background);
