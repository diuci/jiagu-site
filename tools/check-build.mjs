// tools/check-build.mjs —— 构建产物体检。
// 构建成功不等于产物能用：base 写错、数据没打进去、标题被覆盖、色值被顺手改，都能绿着上线。
//
// 检查：
//   1. dist/index.html 存在，且标题正确。
//   2. 引用的 /assets/ 下 js 与 css 都存在（base 写错会一片空白）。
//   3. 缺 dist/assets、缺 js、缺 css 都报。
//   4. 缺 CNAME（自定义域名 jiagu.diuci.com 会失效）或缺 .nojekyll 都报。
//   5. 缺 favicon 报。
//   6. 设计令牌（--paper/--ink/--cinnabar/--line 等）与主站逐值一致——五个站共用一套值。
//
// 用法：node tools/check-build.mjs / --selftest

import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist')
const STYLES = resolve(HERE, '../src/styles/main.css')
const TOKENS = resolve(HERE, '../src/styles/tokens.css')
const TITLE = '甲骨猜字 · 丢词夺理'

// 与主站 _deploy/ui/tokens.css 逐值一致（宣纸色 + 朱砂）。
// 2026-10-19：这几个值原本要求写在 src/styles/main.css 的 :root 里，
// 那是接入全站 UI 体系之前的做法 —— 本站现在把 tokens.css 原样引入，
// 令牌的正本是 _deploy/ui/tokens.css，副本由 check-ui.mjs 按 sha256 守。
// 所以这里改成核对 tokens.css 本身，不再要求 main.css 重复定义一遍
// （重复定义正是规范 §1 明令禁止的）。
const LIGHT = {
  '--paper': '#f4ede0',
  '--ink': '#241f1a',
  '--cinnabar': '#c8442e',
  '--line': '#d8cbb4',
}

function parseRoot(css) {
  const lines = css.split('\n')
  let hit = ''
  for (const line of lines) if (line.trimStart().startsWith(':root')) { hit = line; break }
  if (!hit) return null
  const openAt = css.indexOf('{', css.indexOf(hit))
  const closeAt = css.indexOf('}', openAt)
  if (openAt < 0 || closeAt < 0) return null
  const body = css.slice(openAt + 1, closeAt)
  const out = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

export function checkText(css) {
  const problems = []
  const light = parseRoot(css)
  if (!light) problems.push('找不到行首的 :root 块')
  for (const [k, v] of Object.entries(LIGHT)) {
    if (!light) break
    if (light[k] !== v) problems.push(k + ' 应为 ' + v + '，实际 ' + light[k])
  }
  return problems
}

export function checkDir(dir) {
  const problems = []
  const htmlPath = resolve(dir, 'index.html')
  if (!existsSync(htmlPath)) return ['dist/index.html 不存在']
  const html = readFileSync(htmlPath, 'utf8')
  if (!html.includes(TITLE)) problems.push('标题不是「' + TITLE + '」')
  // 资源必须是相对根路径；base 写错时页面能打开但一片空白
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
  if (!assets.length) problems.push('产物里找不到 /assets/ 下的 js 或 css')
  for (const a of assets) if (!existsSync(resolve(dir, a.replace(/^\//, '')))) problems.push('产物引用了不存在的文件：' + a)
  const assetsDir = resolve(dir, 'assets')
  if (!existsSync(assetsDir)) problems.push('缺 dist/assets')
  else {
    const files = readdirSync(assetsDir)
    if (!files.some((f) => f.endsWith('.js'))) problems.push('dist/assets 里没有 js')
    if (!files.some((f) => f.endsWith('.css'))) problems.push('dist/assets 里没有 css')
  }
  if (!existsSync(resolve(dir, 'CNAME'))) problems.push('缺 dist/CNAME，自定义域名 jiagu.diuci.com 会失效')
  if (!existsSync(resolve(dir, '.nojekyll'))) problems.push('缺 dist/.nojekyll')
  if (!existsSync(resolve(dir, 'favicon.svg'))) problems.push('缺 favicon')
  // 色值核对：六站共用一套值，「有人顺手调好看一点」必须被抓到。
// 查的是 tokens.css（令牌副本），不是 main.css —— 令牌归正本管，
// main.css 只许 var() 引用，不许重复定义（规范 §1）。
let css = null
try { css = readFileSync(TOKENS, 'utf8') } catch { problems.push('读不到 src/styles/tokens.css') }
if (css !== null) for (const p of checkText(css)) problems.push(p)
  return problems
}

function selftest() {
  const cases = []
  // 不存在的 dist 要被抓到
  if (!checkDir(resolve(HERE, '../no-such-dist')).length) { console.error('[!!] 不存在的 dist 没被抓到'); return 1 }
  cases.push('缺 dist 被抓')
  // 坏产物：标题错 + 缺 assets + 缺 CNAME
  const dir = mkdtempSync(resolve(tmpdir(), 'jiagu-check-'))
  writeFileSync(resolve(dir, 'index.html'), '<html><head><title>错的</title></head><body>x</body></html>')
  const r = checkDir(dir)
  if (r.length < 3) { console.error('[!!] 坏产物只报了 ' + r.length + ' 条：' + r.join(' / ')); return 1 }
  cases.push('坏产物被抓（' + r.length + ' 条）')
  // 改色要被抓
  if (!checkText(':root{--paper:#fff}').length) { console.error('[!!] 改色没被抓到'); return 1 }
  cases.push('改色被抓')
  console.log('[ok] check-build --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/check-build.mjs')
if (isEntry) {
  if (process.argv.includes('--selftest')) process.exitCode = selftest()
  else {
    const problems = checkDir(DIST)
    if (problems.length) { for (const p of problems) console.error('[!!] ' + p); process.exitCode = 1 }
    else console.log('[ok] 产物体检：dist 齐（' + TITLE + '、assets、CNAME、.nojekyll、favicon），色值与主站一致')
  }
}
