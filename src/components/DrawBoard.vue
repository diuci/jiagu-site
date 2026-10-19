<script setup>
// 画布（PLAN-画甲骨文 §3.3）：看今字，画它的甲骨形。
//
// - 指针事件统一鼠标与触摸；touch-action: none 防止页面跟着滚
// - 一笔 = 按下 → 移动 → 抬起；撤销保留最近 10 笔，逐笔回退
// - 三档底纹：临摹 = 目标字形原图垫底照描；描红 = 淡底纹；自由画 = 空白
// - 点列实时采样（move 节流交给浏览器帧率），笔画数据交父组件判定
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  glyphUrl: { type: String, required: true }, // 渲染字形（底纹用）
  level: { type: String, required: true }, // trace | copy | free
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'change'])

const canvas = ref(null)
const strokes = ref([]) // 每笔的点列
const drawing = ref(false)
const cur = ref([])

let ctx = null

function cssSize() {
  const el = canvas.value
  return el ? el.clientWidth : 320
}

function setup() {
  const el = canvas.value
  if (!el) return
  const size = cssSize()
  el.width = size
  el.height = size
  ctx = el.getContext('2d')
  repaint()
}

function repaint() {
  if (!ctx) return
  const size = cssSize()
  ctx.clearRect(0, 0, size, size)
  // 底纹：临摹原色照描；描红淡影；自由画无
  const img = bottomImage.value
  if (img && props.level !== 'free') {
    ctx.globalAlpha = props.level === 'trace' ? 0.55 : 0.16
    ctx.drawImage(img, 0, 0, size, size)
    ctx.globalAlpha = 1
  }
  // 玩家笔画：朱砂粗线
  ctx.strokeStyle = '#c8442e'
  ctx.lineWidth = Math.max(6, size / 64)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const pts of [...strokes.value, cur.value]) {
    if (!pts.length) continue // mount 期 cur 是空数组：跳过，别让它进单点分支崩掉（实抓）
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#c8442e'
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
}

const bottomImage = ref(null)
onMounted(() => {
  setup()
  const img = new Image()
  img.onload = () => { bottomImage.value = img; repaint() }
  img.src = props.glyphUrl
})
watch(() => [props.level, props.glyphUrl], () => {
  strokes.value = []
  cur.value = []
  bottomImage.value = null
  const img = new Image()
  img.onload = () => { bottomImage.value = img; repaint() }
  img.src = props.glyphUrl
  repaint()
})

function pos(e) {
  const el = canvas.value
  const rect = el.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * 512,
    y: ((e.clientY - rect.top) / rect.height) * 512,
  }
}

function down(e) {
  if (props.disabled) return
  e.preventDefault()
  drawing.value = true
  cur.value = [pos(e)]
  repaint()
}
function move(e) {
  if (!drawing.value) return
  e.preventDefault()
  cur.value.push(pos(e))
  repaint()
}
function up() {
  if (!drawing.value) return
  drawing.value = false
  if (cur.value.length) strokes.value = [...strokes.value, cur.value].slice(-10)
  cur.value = []
  emit('change', strokes.value.length)
  repaint()
}

function undo() {
  strokes.value = strokes.value.slice(0, -1)
  emit('change', strokes.value.length)
  repaint()
}
function clearAll() {
  strokes.value = []
  emit('change', 0)
  repaint()
}
function submit() {
  emit('submit', strokes.value.map((s) => s.slice()))
}
</script>

<template>
  <div class="board-wrap">
    <canvas
      ref="canvas"
      class="draw"
      touch-action="none"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @pointerleave="up"
    ></canvas>
    <div class="tools">
      <button class="tbtn" :disabled="disabled || !strokes.length" @click="undo">撤销</button>
      <button class="tbtn" :disabled="disabled || !strokes.length" @click="clearAll">清空</button>
      <button class="tbtn go" :disabled="disabled || !strokes.length" @click="submit">画好了</button>
    </div>
  </div>
</template>

<style scoped>
.board-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.draw {
  width: 100%;
  max-width: 360px;
  aspect-ratio: 1;
  border: 1.5px dashed var(--line);
  border-radius: 12px;
  background: var(--paper-2);
  touch-action: none;
  cursor: crosshair;
}
.tools { display: flex; gap: 10px; }
.tbtn {
  padding: 7px 16px; border: 1px solid var(--line); border-radius: 9px;
  background: var(--surface-hi); color: var(--ink);
  font-size: 14px; cursor: pointer; font-family: var(--round);
}
.tbtn:hover:not(:disabled) { border-color: var(--c-primary); color: var(--c-primary); }
.tbtn:disabled { opacity: .5; cursor: default; }
.tbtn.go { background: var(--c-primary); border-color: var(--c-primary); color: var(--paper); }
.tbtn.go:hover:not(:disabled) { color: var(--paper); filter: brightness(1.06); }
</style>
