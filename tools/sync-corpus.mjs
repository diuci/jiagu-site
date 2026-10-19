// tools/sync-corpus.mjs —— 从内容仓快照字库数据到本站。
//
// 为什么是快照不是直连：内容仓是唯一真源，本站必须能离线构建，
// 而且线上猜到的每一字都要能说出「它是哪个版本、凭什么说它是公有领域」。
// 所以快照里带 contentVersion、来源文件的 sha256、每字的 author / era / license。
//
// 用法：
//   node tools/sync-corpus.mjs           重新快照并写入（先把已发出的日子冻进 history）
//   node tools/sync-corpus.mjs --check   只比对，不写；漂移就失败
//   node tools/sync-corpus.mjs --selftest 用假数据证明冻结逻辑真的会拦

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dayKey, pickDaily } from '../src/logic/daily.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CONTENT_ROOT = process.env.CONTENT_ROOT || resolve(ROOT, '../chinese-oracle-bone-script')
const SOURCE = resolve(CONTENT_ROOT, 'data/characters.json')
const CHARS_DIR = resolve(CONTENT_ROOT, 'characters')
const OUT_CORPUS = resolve(ROOT, 'src/data/corpus.json')
// 甲骨形图放 public/glyphs/：GameView 按 /glyphs/<type>/<id>.png 绝对路径引用，
// Vite 只把 public/ 原样伺服到根路径；放 src/data/ 下不会被伺服，图会破。
const OUT_GLYPHS = resolve(ROOT, 'public/glyphs')

function readSource() {
  let raw
  try { raw = readFileSync(SOURCE) }
  catch { throw new Error('读不到内容仓数据：' + SOURCE + '（设 CONTENT_ROOT 指向内容仓）') }
  const data = JSON.parse(raw.toString('utf8'))
  if (!Array.isArray(data.chars)) throw new Error('内容仓数据里没有 chars 数组')
  return { data, sha256: createHash('sha256').update(raw).digest('hex') }
}

/** 从内容仓的 characters/ 收集所有甲骨形 png 的相对路径（相对 characters/）。 */
function glyphFiles(dir, base = '') {
  const out = []
  if (!dir || !statSyncSafe(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...glyphFiles(p, base ? base + '/' + name : name))
    else if (name.endsWith('.png')) out.push(base ? base + '/' + name : name)
  }
  return out
}
function statSyncSafe(p) { try { return statSync(p).isDirectory() } catch { return false } }

export function buildSnapshot() {
  const { data, sha256 } = readSource()
  const chars = data.chars.map((c) => ({
    id: c.id,
    char: c.char,
    type: c.type,
    subtype: c.subtype || null,
    difficulty: c.difficulty,
    glyph: c.glyph,
    scan: c.scan || null,
    // 字形指纹：内容仓从 GLYPHS 图元算出来的。
    // 游戏站靠它避开「同形字同框」——两个字的图元一样时，那道四选一无解。
    glyphFingerprint: c.glyph_fingerprint || null,
    // 今字笔画数：内容仓从 Unihan kTotalStrokes 取的。
    // 靠它挑形近的干扰项 —— 挑生僻字孩子无从排除，挑形近字才要靠字形判断。
    strokeCount: typeof c.stroke_count === 'number' ? c.stroke_count : null,
    tags: c.tags || [],
    license: c.license,
    author: c.author,
    era: c.era,
    // 公有领域证据：跟着数据一起发布，不只在内容仓里
    authorDied: (data.authors || {})[c.author] ? null : null, // 商代佚名，无卒年
    authorEraEnd: c.era === '商' ? -1300 : null,
  }))
  // 顺序已由内容仓 build.py 排好（type/difficulty/id），这里保持
  const skipped = []
  for (const c of chars) {
    if (!c.char || String(c.char).length !== 1) skipped.push({ id: c.id, reason: '非单字' })
  }
  return {
    contentVersion: data.version,
    sourceSha256: sha256,
    count: chars.length,
    sourceTotal: data.count,
    skipped,
    types: data.types || {},
    chars,
  }
}

/** 把内容仓的甲骨形 png 拷进本站 src/data/glyphs/，返回拷贝数。 */
export function copyGlyphs() {
  const glyphs = glyphFiles(CHARS_DIR)
  let n = 0
  for (const rel of glyphs) {
    const src = join(CHARS_DIR, rel)
    const dest = join(OUT_GLYPHS, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(src, dest)
    n++
  }
  return n
}

/** 把已发出的日子冻进 history：用「旧的」词库算出每一天摇到哪个字。 */
export function freezeHistory(oldCorpus, today) {
  const h = oldCorpus && oldCorpus.history ? oldCorpus.history : null
  const days = h && Array.isArray(h.days) ? h.days.slice() : []
  const charsMap = h && h.chars ? Object.assign({}, h.chars) : {}
  const since = (h && h.since) || today
  const retexted = (h && Array.isArray(h.retexted) ? h.retexted : []).slice()
  const have = new Set(days.map((d) => d.day))
  let added = 0
  if (oldCorpus && Array.isArray(oldCorpus.chars) && oldCorpus.chars.length) {
    const start = new Date(since + 'T00:00:00')
    const end = new Date(today + 'T00:00:00')
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      const day = dayKey(d)
      if (have.has(day)) continue
      const { char } = pickDaily(oldCorpus.chars, day)
      days.push({ day, id: char.id })
      if (!charsMap[char.id]) charsMap[char.id] = char
      added++
    }
  }
  days.sort((a, b) => a.day.localeCompare(b.day))
  // 内容仓后来删了这个字：标 ghost，回放不崩
  const fresh = new Set((oldCorpus && oldCorpus.chars || []).map((c) => c.id))
  for (const id of Object.keys(charsMap)) if (!fresh.has(id)) charsMap[id].ghost = true
  return { since, through: today, added, days, chars: charsMap, retexted }
}

/** 历史合法：日子连续、每条还指向存在的字、昨天已冻。 */
export function checkHistory(h, today) {
  const problems = []
  if (!h || !Array.isArray(h.days) || !h.days.length) return []
  const want = []
  const start = new Date(h.since + 'T00:00:00')
  const end = new Date(h.through + 'T00:00:00')
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) want.push(dayKey(d))
  if (want.length !== h.days.length)
    problems.push('history 有洞：应有 ' + want.length + ' 天，记录里 ' + h.days.length + ' 天')
  for (const rec of h.days) {
    if (!(h.chars || {})[rec.id]) problems.push('history 里 ' + rec.day + ' 指向「' + rec.id + '」，可记录里没有这个字')
  }
  const yesterday = dayKey(new Date(new Date(today + 'T00:00:00').getTime() - 86400000))
  if (String(h.through) < yesterday)
    problems.push('history 只冻到 ' + h.through + '，昨天（' + yesterday + '）还没冻：词库一改，已玩过的日子会被换题')
  return problems
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b) }

function check() {
  const corpus = buildSnapshot()
  let existing
  try { existing = JSON.parse(readFileSync(OUT_CORPUS, 'utf8')) }
  catch { console.error('[!!] 缺 ' + OUT_CORPUS + '：先跑 node tools/sync-corpus.mjs'); return 1 }
  const problems = []
  if (existing.contentVersion !== corpus.contentVersion)
    problems.push('contentVersion 漂移：快照 ' + existing.contentVersion + '，内容仓 ' + corpus.contentVersion)
  if (existing.sourceSha256 !== corpus.sourceSha256)
    problems.push('来源文件 sha256 漂移：内容仓 characters.json 变了但快照没重跑')
  if (!same(existing.chars, corpus.chars)) problems.push('字目内容与内容仓不一致')
  if (!same(existing.skipped, corpus.skipped)) problems.push('跳过清单与重新生成结果不一致')
  for (const q of checkHistory(existing.history, dayKey(new Date()))) problems.push(q)
  if (problems.length) {
    for (const p of problems) console.error('[!!] ' + p)
    console.error('    跑 node tools/sync-corpus.mjs 重新快照')
    return 1
  }
  console.log('[ok] 字库快照与内容仓一致：' + corpus.count + ' 字（跳过 ' + corpus.skipped.length + '），contentVersion ' + corpus.contentVersion)
  return 0
}

function selftest() {
  const cases = []
  const add = (name, fn) => { const r = fn(); if (r !== true) { console.error('[!!] ' + r); process.exitCode = 1; return } cases.push(name) }
  add('非单字被跳过', () => {
    const s = { version: 1, count: 2, chars: [{ id: 'a', char: '日' }, { id: 'b', char: '日月' }] }
    const skipped = s.chars.filter((c) => !c.char || String(c.char).length !== 1)
    return skipped.length === 1 && skipped[0].id === 'b' ? true : '非单字没被跳过'
  })
  add('冻结之后内容仓删字标 ghost', () => {
    const h = freezeHistory({ chars: [], history: { since: '2026-10-07', through: '2026-10-07', days: [{ day: '2026-10-07', id: 'a' }], chars: { a: { id: 'a', char: '日' } } } }, '2026-10-08')
    return h.chars.a.ghost === true ? true : '没了的字没标 ghost'
  })
  add('历史断链被抓', () => {
    const h = { since: '2026-10-07', through: '2026-10-08', days: [{ day: '2026-10-07', id: 'a' }], chars: { a: { id: 'a', char: '日' } } }
    const p = checkHistory(h, '2026-10-08')
    return p.length >= 1 ? true : '断链没被抓'
  })
  console.log('[ok] sync-corpus --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return process.exitCode || 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/sync-corpus.mjs')
if (isEntry) {
  if (process.argv.includes('--selftest')) process.exitCode = selftest()
  else if (process.argv.includes('--check')) process.exitCode = check()
  else {
    let oldCorpus = null
    try { oldCorpus = JSON.parse(readFileSync(OUT_CORPUS, 'utf8')) } catch {}
    const corpus = buildSnapshot()
    const glyphs = copyGlyphs()
    const history = freezeHistory(oldCorpus, dayKey(new Date()))
    corpus.history = history
    mkdirSync(dirname(OUT_CORPUS), { recursive: true })
    writeFileSync(OUT_CORPUS, JSON.stringify(corpus, null, 2) + '\n', 'utf8')
    console.log('[ok] 已快照 ' + corpus.count + ' 字 / 内容仓 ' + corpus.sourceTotal + ' 字（跳过 ' + corpus.skipped.length + '），拷贝 ' + glyphs + ' 张甲骨形')
    console.log('     contentVersion ' + corpus.contentVersion + '，每日题历史冻到 ' + history.through + '（新增 ' + history.added + ' 天）')
    process.exitCode = 0
  }
}
