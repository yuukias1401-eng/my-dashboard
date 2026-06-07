// ============================================
// My Dashboard - Scriptable Widget
// Small（4個分）& Medium（8個分）両対応
// ============================================

const DASHBOARD_URL = "https://yuukias1401-eng.github.io/my-dashboard/"
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
  w.setPadding(14, 14, 14, 14)

  // 6/7（大）と曜日（小）を縦並び
  const dateText = w.addText(`${today.getMonth()+1}/${today.getDate()}`)
  dateText.font = Font.boldSystemFont(32)
  dateText.textColor = Color.white()
  dateText.minimumScaleFactor = 0.8

  const dowText = w.addText(DAY_NAMES[today.getDay()] + '曜日')
  dowText.font = Font.systemFont(11)
  dowText.textColor = new Color('#94a3b8')

  w.addSpacer(4)

  // シフト
  if (shift) {
    const shiftT = w.addText(shift)
    shiftT.font = Font.boldSystemFont(16)
    shiftT.textColor = shiftColor
  }

  w.addSpacer(6)

  // 区切り線
  const line = w.addStack()
  line.backgroundColor = new Color('#334155')
  line.size = new Size(130, 1)

  w.addSpacer(6)

  // 予定（最大2件）
  if (todayEvents.length > 0) {
    for (const ev of todayEvents.slice(0, 2)) {
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
  const isSmall = config.widgetFamily === 'small'

  let widget
  try {
    const { idToken, uid } = await getIdToken()
    const monthData = await fetchMonth(idToken, uid, yearMonth)
    widget = isSmall
      ? makeSmallWidget(monthData, today)
      : makeMediumWidget(monthData, today)
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
