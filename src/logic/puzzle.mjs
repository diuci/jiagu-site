// 《甲骨猜字》玩法规则：四选一生成与校验。客户端与 tools/check-puzzle.mjs 共用这一份。
//
// 规则：给一个字（今字），生成四个候选（含正确今字 + 三个干扰字）。
// 干扰字从词库里取，不与答案重复、不为空、互不相同。
// 校验：候选恰好 4 个、答案在其中、无重复、无空字。

/**
 * 为目标字生成四个候选。
 * @param target 目标字 {id, char, ...}
 * @param chars 全词库（顺序稳定）
 * @returns 四个字的数组（含 target），顺序固定（target 在前，便于确定性回放）
 */
export function makeChoices(target, chars) {
  if (!target || !target.char) throw new Error('目标字缺失')
  const targetChar = String(target.char)
  const pool = chars.filter((c) => c && c.char && String(c.char) !== targetChar)
  // 干扰字按 id 排序取前三个，保证确定性（不随机，回放稳定）
  const distractors = pool.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 3)
  const choices = [targetChar]
  for (const d of distractors) choices.push(String(d.char))
  return choices
}

/** 校验一个候选组：恰好 4 个、答案在其中、无重复、无空字。 */
export function verify(choices, target) {
  const problems = []
  if (!Array.isArray(choices) || choices.length !== 4) {
    problems.push('候选必须恰好 4 个，实 ' + (Array.isArray(choices) ? choices.length : 0))
    return problems
  }
  const targetChar = String(target.char)
  if (!choices.includes(targetChar)) problems.push('正确答案「' + targetChar + '」不在候选里')
  const seen = new Set()
  for (const c of choices) {
    const s = String(c).trim()
    if (!s) { problems.push('候选有空字'); break }
    if (s.length !== 1) problems.push('候选非单字：' + s)
    if (seen.has(s)) problems.push('候选重复：' + s)
    seen.add(s)
  }
  return problems
}

/** 判断玩家答案是否正确。 */
export function isCorrect(choice, target) {
  return String(choice).trim() === String(target.char)
}
