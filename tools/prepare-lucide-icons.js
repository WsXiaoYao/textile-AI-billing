#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'assets/icons/lucide/source');
const tabbarDir = path.join(rootDir, 'assets/tabbar');
const tabbarSvgDir = path.join(tabbarDir, 'svg');

const lucideBaseUrl = 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons';
const normalColor = '#7A869A';
const selectedColor = '#1677FF';
const maxTabbarBytes = 40 * 1024;

const icons = [
  { name: 'house', usage: '首页 / 开单入口' },
  { name: 'receipt-text', usage: '订单' },
  { name: 'clipboard-list', usage: '订单备选' },
  { name: 'users', usage: '客户' },
  { name: 'user', usage: '我的' },
  { name: 'shopping-cart', usage: '购物车' },
  { name: 'search', usage: '搜索' },
  { name: 'settings', usage: '设置' },
  { name: 'ellipsis', usage: '更多' },
  { name: 'package', usage: '商品' },
  { name: 'trash-2', usage: '删除' },
  { name: 'plus', usage: '新增' },
  { name: 'chevron-right', usage: '进入详情' },
];

const tabbarIcons = [
  { source: 'house', output: 'home', label: '开单' },
  { source: 'receipt-text', output: 'orders', label: '订单' },
  { source: 'users', output: 'customers', label: '客户' },
  { source: 'ellipsis', output: 'more', label: '更多' },
  { source: 'user', output: 'profile', label: '我的' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location).then(resolve, reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${res.statusCode} ${url}`));
          res.resume();
          return;
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function tintSvg(svg, color) {
  return svg
    .replace(/width="24"/, 'width="81"')
    .replace(/height="24"/, 'height="81"')
    .replace(/stroke="currentColor"/g, `stroke="${color}"`);
}

function hasCommand(command) {
  const result = spawnSync('command', ['-v', command], { shell: true });
  return result.status === 0;
}

function renderPng(svgPath, outputPngPath) {
  if (!hasCommand('qlmanage')) {
    return { rendered: false, reason: 'qlmanage not found' };
  }

  const outDir = path.dirname(svgPath);
  const thumbnailPath = `${svgPath}.png`;
  fs.rmSync(thumbnailPath, { force: true });

  const result = spawnSync('qlmanage', ['-t', '-s', '81', '-o', outDir, svgPath], {
    encoding: 'utf8',
  });

  if (result.status !== 0 || !fs.existsSync(thumbnailPath)) {
    return {
      rendered: false,
      reason: (result.stderr || result.stdout || 'qlmanage failed').trim(),
    };
  }

  fs.renameSync(thumbnailPath, outputPngPath);
  return { rendered: true };
}

function verifyPng(outputPngPath) {
  const stats = fs.statSync(outputPngPath);
  let width = null;
  let height = null;

  if (hasCommand('sips')) {
    const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', outputPngPath], {
      encoding: 'utf8',
    });
    const widthMatch = result.stdout.match(/pixelWidth:\s*(\d+)/);
    const heightMatch = result.stdout.match(/pixelHeight:\s*(\d+)/);
    width = widthMatch ? Number(widthMatch[1]) : null;
    height = heightMatch ? Number(heightMatch[1]) : null;
  }

  return {
    bytes: stats.size,
    width,
    height,
    okSize: stats.size <= maxTabbarBytes,
    okDimensions: width === null || height === null || (width === 81 && height === 81),
  };
}

async function main() {
  ensureDir(sourceDir);
  ensureDir(tabbarDir);
  ensureDir(tabbarSvgDir);

  const downloaded = new Map();

  for (const icon of icons) {
    const url = `${lucideBaseUrl}/${icon.name}.svg`;
    const svg = await download(url);
    const outputPath = path.join(sourceDir, `${icon.name}.svg`);
    fs.writeFileSync(outputPath, svg);
    downloaded.set(icon.name, svg);
  }

  const tabbarManifest = [];

  for (const icon of tabbarIcons) {
    const sourceSvg = downloaded.get(icon.source);
    if (!sourceSvg) {
      throw new Error(`Missing source icon: ${icon.source}`);
    }

    for (const state of [
      { suffix: '', color: normalColor, selected: false },
      { suffix: '-active', color: selectedColor, selected: true },
    ]) {
      const baseName = `${icon.output}${state.suffix}`;
      const svgPath = path.join(tabbarSvgDir, `${baseName}.svg`);
      const pngPath = path.join(tabbarDir, `${baseName}.png`);
      fs.writeFileSync(svgPath, tintSvg(sourceSvg, state.color));

      const renderResult = renderPng(svgPath, pngPath);
      const verifyResult = renderResult.rendered ? verifyPng(pngPath) : null;

      tabbarManifest.push({
        label: icon.label,
        source: icon.source,
        selected: state.selected,
        color: state.color,
        svg: path.relative(rootDir, svgPath),
        png: renderResult.rendered ? path.relative(rootDir, pngPath) : null,
        renderResult,
        verifyResult,
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      name: 'Lucide Icons',
      url: 'https://github.com/lucide-icons/lucide',
      rawBaseUrl: lucideBaseUrl,
      license: 'ISC',
    },
    colors: {
      normal: normalColor,
      selected: selectedColor,
    },
    icons,
    tabbarIcons: tabbarManifest,
  };

  fs.writeFileSync(
    path.join(rootDir, 'assets/icons/lucide/manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const failed = tabbarManifest.filter((item) => !item.renderResult.rendered);
  const invalid = tabbarManifest.filter(
    (item) =>
      item.verifyResult && (!item.verifyResult.okSize || !item.verifyResult.okDimensions),
  );

  console.log(`[icons] downloaded ${icons.length} Lucide SVG files`);
  console.log(`[icons] generated ${tabbarManifest.length - failed.length} tabBar PNG files`);

  if (failed.length > 0) {
    console.warn('[icons] PNG render failed for:');
    failed.forEach((item) => console.warn(`- ${item.svg}: ${item.renderResult.reason}`));
  }

  if (invalid.length > 0) {
    console.warn('[icons] PNG verification warnings:');
    invalid.forEach((item) => {
      const result = item.verifyResult;
      console.warn(`- ${item.png}: ${result.width}x${result.height}, ${result.bytes} bytes`);
    });
  }

  if (failed.length > 0 || invalid.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
