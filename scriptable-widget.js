// ============================================
// My Dashboard - Scriptable Widget
// Small（4個分）& Medium（8個分）両対応
// ============================================

const DASHBOARD_URL = "https://yuukias1401-eng.github.io/my-dashboard/"
const CALENDAR_URL  = "https://yuukias1401-eng.github.io/my-dashboard/#calendar"
const API_KEY = "AIzaSyA1DGiJ6TShj6ZI5_j-vkR5gSKsxEfUwqA"
const PROJECT_ID = "trade-log-c20dd"
const KEYCHAIN_KEY = "mydashboard_token"

const SHIFT_COLORS = {
  '1勤':    '#d97706',
  '2勤':    '#1d4ed8',
  '明け':   '#7c3aed',
  '休み':   '#e11d48',
  '有給':   '#059669',
  '1勤補充': '#ea580c',
  '2勤補充': '#2563eb',
  '日専':   '#0d9488',
}

const DAY_NAMES = ['日','月','火','水','木','金','土']

// ── セットアップ ──────────────────────────
async function setup() {
  if (!Keychain.contains(KEYCHAIN_KEY)) {
    const alert = new Alert()
    alert.title = "初回セットアップ"
    alert.message = "my-dashboardのホーム画面で「トークンを表示」を押してコピーしたJSONを貼り付けてください。"
    alert.addTextField("JSONを貼り付け", "")
    alert.addAction("保存")
    alert.addCancelAction("キャンセル")
    const idx = await alert.present()
    if (idx === 0) {
      const input = alert.textFieldValue(0)
      try {
        JSON.parse(input)
        Keychain.set(KEYCHAIN_KEY, input)
      } catch(e) {
        const err = new Alert()
        err.title = "エラー"
        err.message = "正しいJSON形式ではありません。"
        err.addAction("OK")
        await err.present()
        return false
      }
    }
    return false
  }
  return true
}

// ── トークン取得 ──────────────────────────
async function getIdToken() {
  const stored = JSON.parse(Keychain.get(KEYCHAIN_KEY))
  const req = new Request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`)
  req.method = 'POST'
  req.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  req.body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(stored.refreshToken)}`
  const res = await req.loadJSON()
  if (res.error) throw new Error(res.error.message)
  if (res.refresh_token) {
    stored.refreshToken = res.refresh_token
    Keychain.set(KEYCHAIN_KEY, JSON.stringify(stored))
  }
  return { idToken: res.id_token, uid: stored.uid }
}

// ── Firestore取得 ─────────────────────────
async function fetchMonth(idToken, uid, yearMonth) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shifts/${uid}/months/${yearMonth}`
  const req = new Request(url)
  req.headers = { 'Authorization': `Bearer ${idToken}` }
  try {
    const res = await req.loadJSON()
    return parseDoc(res)
  } catch(e) { return {} }
}
function parseDoc(doc) {
  if (!doc || !doc.fields) return {}
  const out = {}
  for (const [k, v] of Object.entries(doc.fields)) out[k] = parseVal(v)
  return out
}
function parseVal(v) {
  if (v.stringValue  !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return parseInt(v.integerValue)
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.arrayValue)  return (v.arrayValue.values || []).map(parseVal)
  if (v.mapValue)    return parseDoc(v.mapValue)
  return null
}

// ── Small ウィジェット（4個分）────────────
function makeSmallWidget(monthData, today) {
  const days   = monthData.days   || {}
  const events = monthData.events || {}
  const shift  = days[String(today.getDate())]
  const shiftColor = new Color(SHIFT_COLORS[shift] || '#64748b')
  const todayEvents = (events[String(today.getDate())] || [])
    .sort((a, b) => (a.time||'').localeCompare(b.time||''))

  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = DASHBOARD_URL
  w.setPadding(10, 12, 10, 12)

  // ── ヘッダー: 6/7（左大）| 日曜日＋シフト（右小）──
  const headerRow = w.addStack()
  headerRow.layoutHorizontally()
  headerRow.topAlignContent()

  // 左: 6/7
  const dateText = headerRow.addText(`${today.getMonth()+1}/${today.getDate()}`)
  dateText.font = Font.boldSystemFont(30)
  dateText.textColor = Color.white()
  dateText.minimumScaleFactor = 0.8

  headerRow.addSpacer(6)

  // 右: 曜日＋シフトを縦並び（上揃え）
  const rightCol = headerRow.addStack()
  rightCol.layoutVertically()
  rightCol.topAlignContent()

  const dowText = rightCol.addText(DAY_NAMES[today.getDay()] + '曜日')
  dowText.font = Font.systemFont(10)
  dowText.textColor = new Color('#94a3b8')

  if (shift) {
    const shiftT = rightCol.addText(shift)
    shiftT.font = Font.boldSystemFont(13)
    shiftT.textColor = shiftColor
  }

  headerRow.addSpacer()

  w.addSpacer(4)

  // 区切り線
  const line = w.addStack()
  line.backgroundColor = new Color('#334155')
  line.size = new Size(130, 1)

  w.addSpacer(4)

  // 予定（全件表示）
  if (todayEvents.length > 0) {
    for (const ev of todayEvents) {
      const row = w.addStack()
      row.layoutHorizontally()
      row.spacing = 5
      const t = row.addText(ev.time || '--:--')
      t.font = Font.boldSystemFont(10)
      t.textColor = new Color('#60a5fa')
      const ti = row.addText(ev.title || '')
      ti.font = Font.systemFont(10)
      ti.textColor = Color.white()
      ti.lineLimit = 1
      w.addSpacer(2)
    }
  } else {
    const noEv = w.addText('予定なし')
    noEv.font = Font.systemFont(10)
    noEv.textColor = new Color('#475569')
  }

  w.addSpacer() // 残りのスペースを下に押し込む

  return w
}

// ── Medium ウィジェット（8個分）──────────
function makeMediumWidget(monthData, today) {
  const days   = monthData.days   || {}
  const events = monthData.events || {}
  const shift  = days[String(today.getDate())]
  const shiftColor = new Color(SHIFT_COLORS[shift] || '#64748b')
  const todayEvents = (events[String(today.getDate())] || [])
    .sort((a, b) => (a.time||'').localeCompare(b.time||''))

  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = DASHBOARD_URL
  w.setPadding(14, 16, 14, 16)

  // ヘッダー行
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  // 左：6/7（大）＋ 曜日（小）
  const dateCol = header.addStack()
  dateCol.layoutVertically()

  const dateText = dateCol.addText(`${today.getMonth()+1}/${today.getDate()}`)
  dateText.font = Font.boldSystemFont(38)
  dateText.textColor = Color.white()

  const dowText = dateCol.addText(DAY_NAMES[today.getDay()] + '曜日')
  dowText.font = Font.systemFont(12)
  dowText.textColor = new Color('#94a3b8')

  header.addSpacer()

  // 右：シフト
  if (shift) {
    const shiftCol = header.addStack()
    shiftCol.layoutVertically()
    shiftCol.centerAlignContent()
    const shiftLabel = shiftCol.addText('勤務')
    shiftLabel.font = Font.systemFont(10)
    shiftLabel.textColor = new Color('#64748b')
    const shiftT = shiftCol.addText(shift)
    shiftT.font = Font.boldSystemFont(22)
    shiftT.textColor = shiftColor
  }

  w.addSpacer(10)

  // 区切り線
  const line = w.addStack()
  line.backgroundColor = new Color('#334155')
  line.size = new Size(500, 1)

  w.addSpacer(8)

  // 予定（最大3件）
  if (todayEvents.length > 0) {
    const evTitle = w.addText('今日の予定')
    evTitle.font = Font.systemFont(10)
    evTitle.textColor = new Color('#64748b')
    w.addSpacer(4)
    for (const ev of todayEvents.slice(0, 3)) {
      const row = w.addStack()
      row.layoutHorizontally()
      row.spacing = 8
      const t = row.addText(ev.time || '--:--')
      t.font = Font.boldSystemFont(12)
      t.textColor = new Color('#60a5fa')
      const ti = row.addText(ev.title || '')
      ti.font = Font.systemFont(12)
      ti.textColor = Color.white()
      ti.lineLimit = 1
      w.addSpacer(3)
    }
  } else {
    const noEv = w.addText('今日の予定なし')
    noEv.font = Font.systemFont(12)
    noEv.textColor = new Color('#475569')
  }

  return w
}

// ── エラーウィジェット ────────────────────
// ── 共通: カレンダーグリッド描画 ─────────────
function drawCalGrid(w, monthData, today, cellH, numRows, startFromWeek) {
  const days   = monthData.days   || {}
  const events = monthData.events || {}
  const SHIFT_TEXT_COLORS = {
    '1勤':'#d97706','2勤':'#1d4ed8','明け':'#7c3aed','休み':'#e11d48',
    '有給':'#059669','1勤補充':'#ea580c','2勤補充':'#2563eb','日専':'#0d9488'
  }
  const DAY_SHORT = ['日','月','火','水','木','金','土']
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate()
  const firstDow    = new Date(today.getFullYear(), today.getMonth(), 1).getDay()

  // 曜日ヘッダー
  const dowRow = w.addStack()
  dowRow.layoutHorizontally()
  for (let i = 0; i < 7; i++) {
    const cell = dowRow.addStack()
    cell.layoutHorizontally()
    cell.addSpacer()
    const t = cell.addText(DAY_SHORT[i])
    t.font = Font.systemFont(9)
    t.textColor = i===0 ? new Color('#ef4444') : i===6 ? new Color('#3b82f6') : new Color('#64748b')
    cell.addSpacer()
    if (i < 6) dowRow.addSpacer(1)
  }
  w.addSpacer(3)

  // グリッド行
  let cellDates = []
  if (startFromWeek === 'today') {
    // 今週日曜から14日分
    const weekStart = today.getDate() - today.getDay()
    for (let i = 0; i < numRows * 7; i++) cellDates.push(weekStart + i)
  } else {
    // 月初から（空白込み）
    for (let i = 0; i < firstDow; i++) cellDates.push(0)
    for (let i = 1; i <= daysInMonth; i++) cellDates.push(i)
    // 6行分になるようパディング
    while (cellDates.length < numRows * 7) cellDates.push(0)
  }

  for (let row = 0; row < numRows; row++) {
    const rowStack = w.addStack()
    rowStack.layoutHorizontally()
    for (let col = 0; col < 7; col++) {
      const d = cellDates[row * 7 + col]
      const cell = rowStack.addStack()
      cell.layoutVertically()
      cell.centerAlignContent()
      cell.size = new Size(0, cellH)
      cell.cornerRadius = 3

      const valid = d >= 1 && d <= daysInMonth
      const isToday = valid && d === today.getDate()
      if (isToday) cell.backgroundColor = new Color('#fbbf24', 0.2)

      const shift    = valid ? (days[String(d)] || '') : ''
      const hasEvent = valid && ((events[String(d)] || []).length > 0)

      cell.addSpacer(1)

      // 日付
      const dateStack = cell.addStack()
      dateStack.layoutHorizontally()
      dateStack.addSpacer()
      const dateLabel = dateStack.addText(valid ? String(d) : '')
      dateLabel.font = isToday ? Font.boldSystemFont(10) : Font.systemFont(10)
      dateLabel.textColor = !valid ? new Color('#1e293b') :
        isToday ? new Color('#fbbf24') :
        col===0 ? new Color('#ef4444') : col===6 ? new Color('#3b82f6') : Color.white()
      if (hasEvent) {
        const dot = dateStack.addText('·')
        dot.font = Font.boldSystemFont(12)
        dot.textColor = new Color('#f97316')
      }
      dateStack.addSpacer()

      // シフト
      const shiftStack = cell.addStack()
      shiftStack.layoutHorizontally()
      shiftStack.addSpacer()
      if (shift) {
        const short = shift === '1勤補充' ? '1補' : shift === '2勤補充' ? '2補' : shift
        const sl = shiftStack.addText(short)
        sl.font = Font.boldSystemFont(cellH > 30 ? 8 : 7)
        sl.textColor = new Color(SHIFT_TEXT_COLORS[shift] || '#94a3b8')
      }
      shiftStack.addSpacer()

      cell.addSpacer(1)
      if (col < 6) rowStack.addSpacer(1)
    }
    if (row < numRows - 1) w.addSpacer(2)
  }
}

// ── Medium: 今週＋来週（2週間）────────────
function makeMediumCalWidget(monthData, today) {
  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = CALENDAR_URL
  w.setPadding(10, 10, 10, 10)

  const titleRow = w.addStack()
  titleRow.layoutHorizontally()
  const titleT = titleRow.addText(`${today.getFullYear()}年 ${today.getMonth()+1}月`)
  titleT.font = Font.boldSystemFont(12)
  titleT.textColor = Color.white()
  titleRow.addSpacer()
  w.addSpacer(5)

  drawCalGrid(w, monthData, today, 32, 2, 'today')
  w.addSpacer()
  return w
}

// ── Large: 1ヶ月カレンダー ────────────────
function makeLargeCalWidget(monthData, today) {
  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = CALENDAR_URL
  w.setPadding(10, 10, 10, 10)

  const titleRow = w.addStack()
  titleRow.layoutHorizontally()
  const titleT = titleRow.addText(`${today.getFullYear()}年 ${today.getMonth()+1}月`)
  titleT.font = Font.boldSystemFont(13)
  titleT.textColor = Color.white()
  titleRow.addSpacer()
  w.addSpacer(5)

  drawCalGrid(w, monthData, today, 30, 6, 'month')
  w.addSpacer()
  return w
}

function makeErrorWidget(msg) {
  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = DASHBOARD_URL
  w.setPadding(14,16,14,16)
  const t = w.addText('⚠️ ' + msg)
  t.textColor = new Color('#ef4444')
  t.font = Font.systemFont(11)
  t.lineLimit = 3
  return w
}

// ── メイン ────────────────────────────────
async function main() {
  if (!config.runsInWidget) {
    const ready = await setup()
    if (!ready && !Keychain.contains(KEYCHAIN_KEY)) {
      Script.complete(); return
    }
  }

  const today = new Date()
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
  const family = config.widgetFamily  // 'small' | 'medium' | 'large'

  let widget
  try {
    const { idToken, uid } = await getIdToken()
    const monthData = await fetchMonth(idToken, uid, yearMonth)
    if (family === 'small') {
      widget = makeSmallWidget(monthData, today)
    } else if (family === 'large') {
      widget = makeLargeCalWidget(monthData, today)
    } else {
      // medium: 今日の情報 or 2週間カレンダーを選択可
      // スクリプト名に"Cal"が含まれていたらカレンダー表示
      const isCal = Script.name().includes('Cal')
      widget = isCal
        ? makeMediumCalWidget(monthData, today)
        : makeMediumWidget(monthData, today)
    }
  } catch(e) {
    widget = makeErrorWidget(e.message || '接続エラー')
  }

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    // アプリ内で実行した場合はどちらも確認できる
    await widget.presentSmall()
  }
  Script.complete()
}

await main()
