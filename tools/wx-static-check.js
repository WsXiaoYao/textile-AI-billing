#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const requiredPageExts = ['.js', '.json', '.wxml', '.wxss']

const issues = []

checkJsonFiles()
checkPages()
checkComponents()
checkTabBar()
checkProjectPackaging()
checkNavigationPatterns()
checkBusinessScaffold()
checkJavaScriptSyntax()

if (issues.length) {
  console.error('[wx-static-check] failed')
  for (const issue of issues) console.error(' - ' + issue)
  process.exit(1)
}

console.log('[wx-static-check] ok')

function checkJsonFiles() {
  for (const file of ['app.json', 'project.config.json', 'project.private.config.json']) {
    if (!exists(file)) continue
    readJson(file)
  }
}

function checkPages() {
  const app = readJson('app.json')
  if (!app) return
  if (!Array.isArray(app.pages) || app.pages.length === 0) {
    issues.push('app.json 缺少 pages 配置')
    return
  }

  for (const pagePath of app.pages) {
    for (const ext of requiredPageExts) {
      const file = `${pagePath}${ext}`
      if (!exists(file)) issues.push(`页面文件缺失: ${file}`)
    }
  }
}

function checkComponents() {
  const jsonFiles = walk(projectRoot).filter(file => relative(file).endsWith('.json'))

  for (const file of jsonFiles) {
    const rel = relative(file)
    if (rel.startsWith('.git/') || rel === 'project.private.config.json') continue
    const json = readJson(rel)
    if (!json) continue

    if (json.component === true) {
      const base = rel.replace(/\.json$/, '')
      for (const ext of requiredPageExts) {
        const componentFile = `${base}${ext}`
        if (!exists(componentFile)) issues.push(`组件文件缺失: ${componentFile}`)
      }
    }

    if (json.usingComponents && typeof json.usingComponents === 'object') {
      const ownerDir = path.dirname(rel)
      for (const [name, componentPath] of Object.entries(json.usingComponents)) {
        if (!componentPath) {
          issues.push(`usingComponents.${name} 路径为空: ${rel}`)
          continue
        }

        const componentJson = resolveComponentJson(ownerDir, componentPath)
        if (!componentJson) {
          issues.push(`usingComponents.${name} 指向的组件不存在: ${componentPath} (${rel})`)
          continue
        }

        const componentConfig = readJson(componentJson)
        if (componentConfig && componentConfig.component !== true) {
          issues.push(`usingComponents.${name} 不是小程序组件: ${componentJson}`)
        }
      }
    }
  }
}

function checkTabBar() {
  const app = readJson('app.json')
  if (!app || !app.tabBar) return
  const pages = new Set(app.pages || [])
  const list = app.tabBar.list

  if (!Array.isArray(list) || list.length < 2 || list.length > 5) {
    issues.push('tabBar.list 数量应在 2 到 5 个之间')
    return
  }

  for (const item of list) {
    if (!item.pagePath) {
      issues.push('tabBar 存在缺少 pagePath 的条目')
      continue
    }
    if (!pages.has(item.pagePath)) issues.push(`tabBar.pagePath 未在 pages 中声明: ${item.pagePath}`)
    for (const key of ['iconPath', 'selectedIconPath']) {
      if (!item[key]) continue
      const iconFullPath = path.join(projectRoot, item[key])
      if (!fs.existsSync(iconFullPath)) {
        issues.push(`tabBar.${key} 文件不存在: ${item[key]}`)
        continue
      }
      const size = fs.statSync(iconFullPath).size
      if (size > 40 * 1024) issues.push(`tabBar.${key} 超过 40KB: ${item[key]}`)
    }
  }
}

function checkProjectPackaging() {
  const config = readJson('project.config.json')
  if (!config) return
  const ignores = new Set((config.packOptions && config.packOptions.ignore || []).map(item => `${item.type}:${item.value}`))
  for (const entry of ['folder:artifacts', 'folder:tools', 'folder:docs', 'file:package.json']) {
    if (!ignores.has(entry)) issues.push(`packOptions.ignore 缺少 ${entry}`)
  }
}

function checkNavigationPatterns() {
  for (const file of walk(projectRoot)) {
    const rel = relative(file)
    if (!rel.endsWith('.json') && !rel.endsWith('.js') && !rel.endsWith('.wxml')) continue
    if (rel.startsWith('artifacts/') || rel.startsWith('tools/')) continue
    const content = fs.readFileSync(file, 'utf8')

    if (rel.endsWith('.json') && content.includes('"navigationStyle"') && content.includes('"custom"')) {
      issues.push(`不应再使用自绘手机头部 navigationStyle: custom (${rel})`)
    }

    if (rel.endsWith('.wxml') && /bottom-nav|safe-top|nav-bar|status-bar|capsule/.test(content)) {
      issues.push(`页面仍包含旧的自绘导航/底栏结构: ${rel}`)
    }
  }
}

function checkBusinessScaffold() {
  for (const stalePath of ['utils/mock.js', 'utils/util.js', 'pages/home/home.js', 'pages/orders/orders.js']) {
    if (exists(stalePath)) issues.push(`应清理临时业务文件: ${stalePath}`)
  }
}

function checkJavaScriptSyntax() {
  for (const file of walk(projectRoot)) {
    const rel = relative(file)
    if (!rel.endsWith('.js') || rel.startsWith('artifacts/')) continue
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
    if (result.status !== 0) {
      issues.push(`JS 语法检查失败: ${rel}\n${result.stderr.trim()}`)
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file))
  } catch (error) {
    issues.push(`JSON 解析失败: ${file} (${error.message})`)
    return null
  }
}

function readText(file) {
  const fullPath = path.join(projectRoot, file)
  if (!fs.existsSync(fullPath)) {
    issues.push(`文件不存在: ${file}`)
    return ''
  }
  return fs.readFileSync(fullPath, 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(projectRoot, file))
}

function walk(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(fullPath))
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function relative(file) {
  return path.relative(projectRoot, file).replace(/\\/g, '/')
}

function resolveComponentJson(ownerDir, componentPath) {
  const normalized = componentPath.startsWith('/')
    ? componentPath.slice(1)
    : path.posix.normalize(path.posix.join(ownerDir, componentPath))
  const candidate = `${normalized}.json`
  return exists(candidate) ? candidate : null
}
