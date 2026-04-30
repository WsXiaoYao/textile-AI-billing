#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'assets/icons/lucide/source');
const uiDir = path.join(rootDir, 'assets/icons/lucide/ui');
const tabbarDir = path.join(rootDir, 'assets/tabbar');
const tabbarSvgDir = path.join(tabbarDir, 'svg');

const lucideBaseUrl = 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons';
const normalColor = '#7A869A';
const selectedColor = '#2F6FE4';
const iconDarkColor = '#172033';
const iconWarningColor = '#F79009';
const tabbarCanvasSize = 81;
const tabbarGlyphSize = 58;
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
  { name: 'layout-grid', usage: '产品管理 / 功能入口' },
  { name: 'list', usage: '产品分类' },
  { name: 'gauge', usage: '库存总览 / 统计' },
  { name: 'sliders-horizontal', usage: '库存调整' },
  { name: 'warehouse', usage: '仓库管理' },
  { name: 'handshake', usage: '供应商' },
  { name: 'shopping-bag', usage: '采购单' },
  { name: 'undo-2', usage: '退货单' },
  { name: 'receipt', usage: '欠款总览' },
  { name: 'target', usage: '销售总览' },
  { name: 'bell', usage: '消息提醒' },
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

const uiIcons = [
  { source: 'layout-grid', output: 'layout-grid-blue', color: selectedColor, usage: '产品管理' },
  { source: 'list', output: 'list-dark', color: iconDarkColor, usage: '产品分类' },
  { source: 'gauge', output: 'gauge-dark', color: iconDarkColor, usage: '库存总览' },
  { source: 'sliders-horizontal', output: 'sliders-horizontal-dark', color: iconDarkColor, usage: '库存调整' },
  { source: 'warehouse', output: 'warehouse-dark', color: iconDarkColor, usage: '仓库管理' },
  { source: 'handshake', output: 'handshake-dark', color: iconDarkColor, usage: '供应商' },
  { source: 'shopping-bag', output: 'shopping-bag-orange', color: iconWarningColor, usage: '采购单' },
  { source: 'undo-2', output: 'undo-2-dark', color: iconDarkColor, usage: '退货单' },
  { source: 'receipt', output: 'receipt-orange', color: iconWarningColor, usage: '销售欠款总览' },
  { source: 'target', output: 'target-orange', color: iconWarningColor, usage: '产品销售总览' },
  { source: 'users', output: 'users-orange', color: iconWarningColor, usage: '客户销售总览' },
  { source: 'bell', output: 'bell-dark', color: iconDarkColor, usage: '提醒' },
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
  return svg.replace(/stroke="currentColor"/g, `stroke="${color}"`);
}

function createTabbarSvg(svg, color) {
  const tinted = tintSvg(svg, color);
  const body = tinted
    .replace(/<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
  const scale = tabbarGlyphSize / 24;
  const offset = (tabbarCanvasSize - tabbarGlyphSize) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tabbarCanvasSize}" height="${tabbarCanvasSize}" viewBox="0 0 ${tabbarCanvasSize} ${tabbarCanvasSize}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <g transform="translate(${offset} ${offset}) scale(${scale})">
${indent(body, 4)}
  </g>
</svg>
`;
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function hasCommand(command) {
  const result = spawnSync('command', ['-v', command], { shell: true });
  return result.status === 0;
}

function renderPng(svgPath, outputPngPath) {
  const chromeResult = renderPngWithChrome(svgPath, outputPngPath);
  if (chromeResult.rendered) return chromeResult;

  if (!hasCommand('qlmanage')) {
    return { rendered: false, reason: chromeResult.reason || 'qlmanage not found' };
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

function renderPngWithChrome(svgPath, outputPngPath) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(chromePath)) {
    return { rendered: false, reason: 'Google Chrome not found' };
  }

  const svg = fs.readFileSync(svgPath, 'utf8');
  const htmlPath = `${svgPath}.render.html`;
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${tabbarCanvasSize}px;height:${tabbarCanvasSize}px;background:transparent;overflow:hidden}svg{width:${tabbarCanvasSize}px;height:${tabbarCanvasSize}px;display:block}</style></head><body>${svg}</body></html>`,
  );

  fs.rmSync(outputPngPath, { force: true });
  const result = spawnSync(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--force-device-scale-factor=1',
      `--window-size=${tabbarCanvasSize},${tabbarCanvasSize}`,
      '--default-background-color=00000000',
      `--screenshot=${outputPngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { encoding: 'utf8' },
  );
  fs.rmSync(htmlPath, { force: true });

  if (result.status !== 0 || !fs.existsSync(outputPngPath)) {
    return {
      rendered: false,
      reason: (result.stderr || result.stdout || 'Chrome rendering failed').trim(),
    };
  }

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
  ensureDir(uiDir);
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

  const uiIconManifest = [];

  for (const icon of uiIcons) {
    const sourceSvg = downloaded.get(icon.source);
    if (!sourceSvg) {
      throw new Error(`Missing UI source icon: ${icon.source}`);
    }

    const outputPath = path.join(uiDir, `${icon.output}.svg`);
    fs.writeFileSync(outputPath, tintSvg(sourceSvg, icon.color));
    uiIconManifest.push({
      source: icon.source,
      output: icon.output,
      color: icon.color,
      usage: icon.usage,
      svg: path.relative(rootDir, outputPath),
    });
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
      fs.writeFileSync(svgPath, createTabbarSvg(sourceSvg, state.color));

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
    tabbar: {
      canvasSize: tabbarCanvasSize,
      glyphSize: tabbarGlyphSize,
    },
    icons,
    uiIcons: uiIconManifest,
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
  console.log(`[icons] generated ${uiIconManifest.length} UI SVG files`);
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
