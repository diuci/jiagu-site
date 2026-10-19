// 游戏状态。读取快照，生成题面，记录答案与连击。
import { readonly } from 'vue'
import { dayKey, puzzleFor } from './daily.mjs'
import { isCorrect, makeChoices } from './puzzle.mjs'
import corpus from '../data/corpus.json'

const C = corpus as unknown as {
  count: number
  chars: Array<{
    id: string
    char: string
    type: string
    subtype?: string | null
    difficulty: number
    glyph: string
    tags: string[]
    license: string
    era: string
    strokes: Array<Array<string | number>> | null
    scan?: string | null
  }>
  history?: { since: string; through: string; days: Array<{ day: string; id: string }> }
}

interface State {
  mode: 'daily' | 'practice'
  day: string
  char: (typeof C)['chars'][number] | null
  choices: string[]
  picked: string | null
  answered: boolean
  correct: boolean
  streak: number
  solved: number
}

function load() {
  const day = dayKey(new Date())
  return puzzleFor(C, day)
}

const state: State = {
  mode: 'daily',
  day: dayKey(new Date()),
  char: null,
  choices: [],
  picked: null,
  answered: false,
  correct: false,
  streak: 0,
  solved: 0,
}

// 初始化每日题
Object.assign(state, { char: load().char, choices: load().choices })

export function startDaily() {
  const r = load()
  state.mode = 'daily'
  state.char = r.char
  state.choices = r.choices
  state.picked = null
  state.answered = false
  state.correct = false
}

// 自由练习：按字类/难度筛一个目标字（简单起见随机取一个）
export function startPractice(type?: string, difficulty?: number) {
  let pool = C.chars
  if (type) pool = pool.filter((c) => c.type === type)
  if (difficulty) pool = pool.filter((c) => c.difficulty === difficulty)
  if (!pool.length) pool = C.chars
  const char = pool[Math.floor(Math.random() * pool.length)]
  const choices = makeChoices(char, C.chars)
  state.mode = 'practice'
  state.char = char
  state.choices = choices
  state.picked = null
  state.answered = false
  state.correct = false
}

export function pick(choice: string) {
  if (state.answered || !state.char) return
  state.picked = choice
  state.answered = true
  state.correct = isCorrect(choice, state.char)
  if (state.correct) {
    state.streak += 1
    state.solved += 1
  } else {
    state.streak = 0
  }
}

/** 画字提交：相似度与过/不过由 draw.mjs 判定，这里只管连击/进度。 */
export function submitDraw(_sim: number, pass: boolean) {
  if (pass) {
    state.streak += 1
    state.solved += 1
  } else {
    state.streak = 0
  }
}

export const store = readonly(state)
export { C as corpus }
// dev hook / 冒烟测试用：暴露原始可变 state（普通对象），避免 readonly 代理经浏览器序列化丢数组性
export const rawState = state
export const devHooks = { store: rawState, pick, submitDraw }
