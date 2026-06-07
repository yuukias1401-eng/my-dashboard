// ============================================
// My Dashboard - Scriptable Widget
// ============================================
// 【セットアップ手順】
// 1. my-dashboardをSafariで開いてログイン
// 2. ホームタブ下部の「トークンを表示」をタップ
// 3. 表示されたJSONをコピー
// 4. このスクリプトを最初に実行すると設定画面が出る
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

// ── セットアップ確認 ──────────────────────
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
        JSON.parse(input) // バリデーション
        Keychain.set(KEYCHAIN_KEY, input)
      } catch(e) {
        const err = new Alert()
        err.title = "エラー"
        err.message = "正しいJSON形式ではありません。もう一度やり直してください。"
        err.addAction("OK")
        await err.present()
        return false
      }
    }
    return false
  }
  return true
}

// ── トークン取得・更新 ────────────────────
async function getIdToken() {
  const stored = JSON.parse(Keychain.get(KEYCHAIN_KEY))
  const refreshToken = stored.refreshToken

  const req = new Request(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`)
  req.method = 'POST'
  req.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  req.body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`

  const res = await req.loadJSON()
  if (res.error) throw new Error(res.error.message)

  // 新しいリフレッシュトークンを保存
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
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = parseVal(v)
  }
  return out
}
function parseVal(v) {
  if (v.stringValue !== undefined)  return v.stringValue
  if (v.integerValue !== undefined) return parseInt(v.integerValue)
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.arrayValue)  return (v.arrayValue.values || []).map(parseVal)
  if (v.mapValue)    return parseDoc(v.mapValue)
  return null
}

// ── ウィジェット作成 ──────────────────────
function makeWidget(monthData, today) {
  const days     = monthData.days   || {}
  const events   = monthData.events || {}
  const dayNames = ['日','月','火','水','木','金','土']

  const shift = days[String(today.getDate())]
  const shiftColor = new Color(SHIFT_COLORS[shift] || '#64748b')
  const todayEvents = (events[String(today.getDate())] || [])
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const w = new ListWidget()
  w.backgroundColor = new Color('#1e293b')
  w.url = DASHBOARD_URL
  w.setPadding(14, 16, 14, 16)

  // ── ヘッダー（日付 + シフト）──
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  // 日付（左）
  const dateCol = header.addStack()
  dateCol.layoutVertically()
  const dayNum = dateCol.addText(String(today.getDate()))
  dayNum.font = Font.boldSystemFont(40)
  dayNum.textColor = Color.white()
  const dayName = dateCol.addText(dayNames[today.getDay()] + '曜日')
  dayName.font = Font.systemFont(11)
  dayName.textColor = new Color('#94a3b8')
  const monthLabel = dateCol.addText(`${today.getMonth()+1}月`)
  monthLabel.font = Font.systemFont(11)
  monthLabel.textColor = new Color('#94a3b8')

  header.addSpacer()

  // シフト（右）
  if (shift) {
    const shiftCol = header.addStack()
    shiftCol.layoutVertically()
    shiftCol.centerAlignContent()
    const shiftLabel = shiftCol.addText('勤務')
    shiftLabel.font = Font.systemFont(10)
    shiftLabel.textColor = new Color('#64748b')
    const shiftText = shiftCol.addText(shift)
    shiftText.font = Font.boldSystemFont(20)
    shiftText.textColor = shiftColor
  }

  w.addSpacer(10)

  // ── 区切り線 ──
  const line = w.addStack()
  line.backgroundColor = new Color('#334155')
  line.size = new Size(300, 1)

  w.addSpacer(8)

  // ── 予定一覧 ──
  if (todayEvents.length > 0) {
    const evTitle = w.addText('今日の予定')
    evTitle.font = Font.systemFont(10)
    evTitle.textColor = new Color('#64748b')
    w.addSpacer(4)

    for (const ev of todayEvents.slice(0, 3)) {
      const row = w.addStack()
      row.layoutHorizontally()
      row.spacing = 8
      const timeT = row.addText(ev.time || '--:--')
      timeT.font = Font.boldSystemFont(12)
      timeT.textColor = new Color('#60a5fa')
      timeT.minimumScaleFactor = 0.8
      const titleT = row.addText(ev.title || '')
      titleT.font = Font.systemFont(12)
      titleT.textColor = Color.white()
      titleT.lineLimit = 1
      w.addSpacer(3)
    }
  } else {
    const noEv = w.addText('今日の予定なし')
    noEv.font = Font.systemFont(12)
    noEv.textColor = new Color('#475569')
  }

  return w
}

// ── メイン ────────────────────────────────
async function main() {
  // 初回セットアップ
  if (!config.runsInWidget) {
    const ready = await setup()
    if (!ready && !Keychain.contains(KEYCHAIN_KEY)) {
      Script.complete()
      return
    }
  }

  const today = new Date()
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`

  let widget
  try {
    const { idToken, uid } = await getIdToken()
    const monthData = await fetchMonth(idToken, uid, yearMonth)
    widget = makeWidget(monthData, today)
  } catch(e) {
    widget = new ListWidget()
    widget.backgroundColor = new Color('#1e293b')
    widget.url = DASHBOARD_URL
    widget.setPadding(14,16,14,16)
    const errT = widget.addText('⚠️ ' + (e.message || '接続エラー'))
    errT.textColor = new Color('#ef4444')
    errT.font = Font.systemFont(12)
    const hint = widget.addText('タップして再設定')
    hint.textColor = new Color('#64748b')
    hint.font = Font.systemFont(10)
  }

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    await widget.presentMedium()
  }
  Script.complete()
}

await main()
