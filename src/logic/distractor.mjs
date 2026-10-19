// 干扰项排序：怎么挑三个「长得像但不是它」的字。
//
// 目标：让孩子只能靠甲骨形判断，不能靠「这字我见过」排除。
// 所以优先挑**形近**的（笔画数相同、字类相同），并优先挑**常见的**（基本区）。
//
// 三条规则，从硬到软：
//   1. 不同形：指纹相同的一律排除（makeChoices 已做，这里再挡一次，双保险）
//   2. 常见优先：基本区 +40
//   3. 形近优先：笔画数相同 +40，字类相同 +25，差一笔 +15，差两笔 +5
//
// 权重的来历（实测调出来的，不是拍的）：
//   内容库 151 个「抽象」类字里，58 个是扩展A 区生僻字，笔画均值 9.9，
//   而基本区均值 6.0 —— 生僻字恰好集中在笔画多的一头。
//   若「同笔画」权重压过「常见」，抽象类里挑形近字就必然先撞上生僻字
//   （实测「利」7 画抽象：言(100) 㞷(80) 㕯(80)，两个扩展区字挤进前三）。
//   把常见提到 40 之后：「言 並 多」—— 全是基本区，形近度只差一点点。
//   结论：**常见优先于形近**。生僻字对四选一没有迷惑价值，孩子认不出就等于没给选项。
//
// 全部字段缺失时退回「按 id 排序」—— 与 2026-10-19 之前的行为一致，
// 不假装更聪明。老快照（无指纹/笔画数）走到这里自然落到最后一条。

/** 基本区 = U+4E00–9FFF；扩展A 区 = U+3400–4DBF。生僻程度按这个分。 */
export function charZone(ch) {
  const cp = typeof ch === 'string' ? ch.codePointAt(0) : 0
  if (cp >= 0x4e00 && cp <= 0x9fff) return 'common' // 基本区：课本里出现过
  if (cp >= 0x3400 && cp <= 0x4dbf) return 'rare'   // 扩展A：生僻
  return 'other'
}

/**
 * 给一组候选字打分排序（不修改入参）。
 * @param target 题底
 * @param pool   候选（已排除同形）
 * @returns 按分从高到低排好的数组；同分时按 id 升序，保证回放稳定
 */
export function rankDistractors(target, pool) {
  const tFp = target.glyphFingerprint || null
  const tStrokes = Number.isFinite(target.strokeCount) ? target.strokeCount : null
  const tType = target.type || null

  const scored = pool.map((c) => {
    let score = 0

    // 规则 1：同形直接判死（-1000，排在最后；理论上 makeChoices 已经滤过）
    const cFp = c.glyphFingerprint || null
    if (tFp && cFp && cFp === tFp) score -= 1000

    // 规则 2：常见优先（权重高于形近 —— 见文件头的来历）
    const zone = charZone(c.char)
    if (zone === 'common') score += 40

    // 规则 3：形近优先
    const cStrokes = Number.isFinite(c.strokeCount) ? c.strokeCount : null
    if (tStrokes !== null && cStrokes !== null) {
      const diff = Math.abs(cStrokes - tStrokes)
      if (diff === 0) score += 40
      else if (diff === 1) score += 15   // 差一笔也算近
      else if (diff <= 2) score += 5
    }
    if (tType && c.type === tType) score += 25

    return { c, score }
  })

  scored.sort((a, b) => (b.score - a.score) || String(a.c.id).localeCompare(String(b.c.id)))
  return scored.map((s) => s.c)
}