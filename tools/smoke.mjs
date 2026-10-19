// tools/smoke.mjs —— 真开一个浏览器，把当天这一字从头猜到尾。
//
// 为什么要有它：每日题选字、四选一生成、判定反馈各自都能单元测试，
// 但它们接在一起、真的挂在浏览器 DOM 里，没人验证过。CI 里跑一遍，
// 比任何一条单测都更接近玩家实际会遇到的情况。
//
// 用法：node tools/smoke.mjs --url=http://127.0.0.1:4173
//       node tools/smoke.mjs --selftest   # 自检不开浏览器，只证明工具知道各种失败长什么样

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strokesToPointStrokes } from '../app/src/logic/draw.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  homedir() + '/AppData/Local/Programs/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p
  return null
}

/** 从浏览器读出的当日题状态。 */
export function stateProblems(s) {
  const problems = []
  if (!s) { problems.push('?dev=hey 没有挂出这一局'); return problems }
  if (!s.char) { problems.push('读不到当日题的字'); return problems }
  if (!Array.isArray(s.choices) || s.choices.length !== 4) {
    problems.push('候选不是 4 个（' + (Array.isArray(s.choices) ? s.choices.length : 0) + '）'); return problems
  }
  if (!s.choices.includes(s.char.char)) problems.push('正确答案不在候选里')
  return problems
}

export async function run(url) {
  const chrome = findChrome()
  if (!chrome) { console.error('[!!] 找不到 Chrome/Chromium，设 CHROME_PATH 指一下'); return 1 }
  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const problems = []
  const errors = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 780 })
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

    const target = url.replace(/\/$/, '') + '/?dev=hey'
    await page.goto(target, { waitUntil: 'networkidle2', timeout: 45000 })

    const s = await page.evaluate(() => {
      const g = window.__jiagu
      if (!g) return null
      return { char: g.store.char, choices: g.store.choices, answered: g.store.answered, correct: g.store.correct }
    })
    problems.push(...stateProblems(s))

    // 每日题已切画字玩法（拍板 2026-10-19）：查画布存在 + 真交互驱动到完成态；
    // 甲骨形图加载检查移到猜字分支（.glyph 是猜字模式的元素）。
    const hasCanvas = await page.evaluate(() => !!document.querySelector('.draw'))
    if (!hasCanvas) problems.push('每日题画布没渲染（.draw 缺失）')

    if (!problems.length && s) {
      // 真交互驱动（PLAN 步骤 8）：把标准答案点列 dispatch 成真实 pointer 事件流，
      // 走 DrawBoard 的 pos() 采样 → 「画好了」按钮 → onDrawSubmit → 判定 → 完成态。
      // 判定算法本身由 check-draw 把关；这里验证的是 DOM 事件链真通。
      const pss = strokesToPointStrokes(s.char.strokes)
      if (!pss.length) problems.push('快照里这个字没有 strokes，画字链路无法驱动')
      else {
        await page.evaluate((pointStrokes) => {
          const canvas = document.querySelector('.draw')
          const rect = canvas.getBoundingClientRect()
          const toClient = (p) => ({ x: rect.left + (p.x / 512) * rect.width, y: rect.top + (p.y / 512) * rect.height })
          const fire = (type, p) => canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, clientX: p.x, clientY: p.y,
          }))
          for (const pts of pointStrokes) {
            const cs = pts.map(toClient)
            fire('pointerdown', cs[0])
            for (const p of cs.slice(1)) fire('pointermove', p)
            fire('pointerup', cs[cs.length - 1])
          }
        }, pss)
        const clicked = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('.tbtn.go')].find((b) => !b.disabled)
          if (!btn) return false
          btn.click()
          return true
        })
        if (!clicked) problems.push('「画好了」按钮不可点（画布没收到笔画？）')
        const after = await page.evaluate(() => ({ solved: window.__jiagu.store.solved, streak: window.__jiagu.store.streak }))
        if (!after.solved) problems.push('真画标准答案后没进入已解态（采样/判定链断了）')
        // DOM 断言：只查 store 状态抓不住「写进去了但页面没渲染」（2026-10-20 实抓：
        // store 曾是 readonly(普通对象)，猜字反馈状态变了几个月、DOM 一次没渲染过）
        const hasFb = await page.waitForSelector('.feedback', { timeout: 3000 }).then(() => true).catch(() => false)
        if (!hasFb) problems.push('判定反馈没渲染（.feedback 缺失）——store 写入没穿过响应式')
      }

      mkdirSync('shots', { recursive: true })
      await page.screenshot({ path: 'shots/daily.png', fullPage: true })
      console.log('[ok] 冒烟：当日字「' + s.char.char + '」真画 ' + pss.length + ' 笔标准答案，画布→提交→判定一路到完成态')
    }
    return finish(problems, errors)
  }
  catch (e) {
    console.error('[!!] 冒烟崩了：' + e.message)
    return 1
  }
  finally { await browser.close() }

  function finish(problems, errors) {
    for (const e of errors.slice(0, 6)) console.error('     ' + e)
    if (problems.length) {
      for (const p of problems) console.error('[!!] ' + p)
      return 1
    }
    if (errors.length) { console.error('[!!] 页面有 ' + errors.length + ' 条报错'); return 1 }
    return 0
  }
}

function selftest() {
  const cases = []
  const add = (label, ok) => { if (!ok) { console.error('[!!] 坏样本「' + label + '」没被抓到'); process.exitCode = 1; return } cases.push(label) }
  if (!findChrome()) console.log('     （本机没有 Chrome，自检只跑不依赖浏览器的部分）')
  else cases.push('找得到 Chrome')
  if (!process.env.SMOKE_URL) cases.push('没给 --url 时不瞎跑')
  add('缺状态会被抓到', stateProblems(null).length > 0)
  add('候选不是 4 个会被抓到', stateProblems({ char: { char: '日' }, choices: ['日', '月', '山'] }).length > 0)
  add('正确答案不在候选会被抓到', stateProblems({ char: { char: '日' }, choices: ['月', '山', '水', '火'] }).length > 0)
  add('合规状态不误伤', stateProblems({ char: { char: '日' }, choices: ['日', '月', '山', '水'], answered: false, correct: false }).length === 0)
  // 真交互驱动的点列构造（步骤 8）：展开形状对，坏数据展开成空
  add('line 图元展开成一笔三点（端点+中点）', (() => {
    const [pts] = strokesToPointStrokes([['line', 100, 140, 100, 330]])
    return pts.length === 3 && pts[0].x === 100 && pts[1].y === 235 && pts[2].y === 330
  })())
  add('圆/点类图元展开成中心单点', (() => {
    const [pts] = strokesToPointStrokes([['circle', 256, 256, 110]])
    return pts.length === 1 && pts[0].x === 256 && pts[0].y === 256
  })())
  add('rect 图元展开成对角线两笔点', (() => {
    const [pts] = strokesToPointStrokes([['rect', 100, 100, 300, 300]])
    return pts.length === 2 && pts[1].x === 300 && pts[1].y === 300
  })())
  add('空/缺 strokes 展开成空数组（驱动前会被拦下）', strokesToPointStrokes(undefined).length === 0 && strokesToPointStrokes([]).length === 0)
  console.log('[ok] smoke --selftest 通过（' + cases.length + ' 项：' + cases.join('、') + '）')
  return process.exitCode || 0
}

const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/smoke.mjs')
if (isEntry) {
  if (process.argv.includes('--selftest')) process.exitCode = selftest()
  else {
    const arg = process.argv.find((a) => a.startsWith('--url='))
    if (!arg) { console.error('用法：node tools/smoke.mjs --url=http://127.0.0.1:4173'); process.exitCode = 2 }
    else process.exitCode = await run(arg.slice(6))
  }
}
