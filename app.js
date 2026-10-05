/* ============================================================
   婚約前の確認 – app.js
   ------------------------------------------------------------
   共有リンクは「id（短いランダムID）＋復号鍵（URLのフラグメント）」
   のみで構成される。回答本体は暗号化されたうえで GAS 経由で
   スプレッドシートに保存され、復号鍵はサーバーに送信されない
   （URLの # 以降はブラウザからサーバーへ送信されないため）。
   ============================================================ */

const LIFF_ID   = "YOUR_LIFF_ID_HERE"; // ← デプロイ先のLIFF IDに差し替える
const DRAFT_KEY = "konyaku_zenno_kakunin_draft";
const PENDING_SHARED_VIEW_KEY = "konyaku_zenno_kakunin_pending_shared_view";

// ▼▼▼ デプロイ済みGAS Web AppのURL ▼▼▼
const GAS_ENDPOINT = "YOUR_GAS_WEBAPP_EXEC_URL_HERE";

/* ============================================================
   質問定義（HTML・app.js・code.gs で質問番号を統一するための唯一の情報源）
   type: "text"  … textarea 1つのみ
         "radio" … ラジオボタン（options必須）。detailId を指定すると、
                   detailShowValues に含まれる値が選ばれたときだけ
                   テキストエリアを表示する。
   ============================================================ */
const QUESTIONS = [
  { id: "q1",  type: "text",  label: "Q1 真剣交際に進もうと思ったのはなぜですか？パートナーのどんなところがいいなと思っていますか？" },
  { id: "q2",  type: "text",  label: "Q2 この際だから言っておきたい、パートナーへの不満やもっとしてほしいことを伝えておきましょう。" },
  { id: "q3",  type: "text",  label: "Q3 パートナーから何と呼ばれたいですか？" },
  { id: "q4",  type: "radio", label: "Q4 家事分担について、ルールを決めておきたいですか？", options: [
      { value: "a4-1", text: "決めたい" },
      { value: "a4-2", text: "一緒に暮らし始めてから決めたい" },
      { value: "a4-3", text: "ルールは決めずにやっていきたい" },
    ] },
  { id: "q5",  type: "text",  label: "Q5 将来は何歳くらいまで働きたいですか？定年後も再雇用や非正規雇用で働き続けたいですか？" },
  { id: "q6",  type: "text",  label: "Q6 将来、自分の親の介護が必要になった場合の現時点での計画はありますか？" },
  { id: "q7",  type: "text",  label: "Q7 年収はいくらですか？今年の見込み年収を教えてください。副業があれば、本業、副業それぞれいくらかも教えてください。" },
  { id: "q8",  type: "text",  label: "Q8 貯金はいくらありますか？現金での貯金額を教えてください。" },
  { id: "q9",  type: "text",  label: "Q9 株などの金融資産や不動産など、現金以外での貯蓄があれば、何を持っているか、必要であれば現金化できるようなものか教えてください。" },
  { id: "q10", type: "text",  label: "Q10 現在の支出状況について教えてください。" },
  { id: "q11", type: "radio", label: "Q11 お金の管理方法はどうしたいですか？", detailId: "q11Detail", detailShowValues: ["a11-4"], options: [
      { value: "a11-1", text: "どちらかに管理をお願いし、お小遣い制にする" },
      { value: "a11-2", text: "共同口座を作り、生活費や将来のための貯蓄を定期的にお互い入金する" },
      { value: "a11-3", text: "原則それぞれで管理し、支出が必要になるタイミングで支払う" },
      { value: "a11-4", text: "その他" },
    ] },
  { id: "q12", type: "radio", label: "Q12 大きい買い物をするときは個人の買い物であっても相談したいですか？", detailId: "q12Detail", detailShowValues: ["a12-1"], options: [
      { value: "a12-1", text: "大きい額のときは相談したい、してほしい" },
      { value: "a12-2", text: "個人の買い物は相談しなくてよい" },
    ] },
  { id: "q13", type: "text",  label: "Q13 毎月どれくらい貯蓄したいですか？" },
  { id: "q14", type: "text",  label: "Q14 投資はしたいですか？" },
  { id: "q15", type: "text",  label: "Q15 保険への加入や、すでに加入している方はプランの変更など考えていますか？" },
  { id: "q16", type: "text",  label: "Q16 現在の勤め先で、結婚休暇などの結婚支援制度はありますか？あれば具体的に教えてください。" },
  { id: "q17", type: "text",  label: "Q17 現在の勤め先で、出産・育児支援制度はどんなものがありますか？" },
  { id: "q18", type: "text",  label: "Q18 死亡時や働けなくなった時、会社独自の給与補償のようなものはありますか？" },
  { id: "q19", type: "radio", label: "Q19 ベッド、寝室について理想はありますか？", options: [
      { value: "a19-1", text: "大きめのベッドで一緒に寝たい" },
      { value: "a19-2", text: "同じ寝室でベッドは分けたい" },
      { value: "a19-3", text: "寝室を分けたい" },
    ] },
  { id: "q20", type: "radio", label: "Q20 結納や両家顔合わせはしますか？", options: [
      { value: "a20-1", text: "したい" },
      { value: "a20-2", text: "するつもりはないがお相手次第" },
      { value: "a20-3", text: "自身の両親と話していないので後日相談させてほしい" },
    ] },
  { id: "q21", type: "radio", label: "Q21 婚約指輪はほしいですか？もしくはあげたいですか？", options: [
      { value: "a21-1", text: "ほしい、もしくはあげたい" },
      { value: "a21-2", text: "相手が望むならあげたい" },
      { value: "a21-3", text: "ほしくない、もしくはあげたくない" },
    ] },
  { id: "q22", type: "radio", label: "Q22 結婚指輪はほしいですか？", options: [
      { value: "a22-1", text: "ほしい" },
      { value: "a22-2", text: "相手が望むならほしい" },
      { value: "a22-3", text: "自分はいらないが、相手が望むなら相手の分はあげたい" },
      { value: "a22-4", text: "自分はほしいが、相手の分は相手の意思に任せる" },
      { value: "a22-5", text: "ほしくないし、あげたくもない" },
    ] },
  { id: "q23", type: "radio", label: "Q23 結婚式はしたいですか？", options: [
      { value: "a23-1", text: "したい" },
      { value: "a23-2", text: "相手が望むならしてもよい" },
      { value: "a23-3", text: "したくない" },
    ] },
  { id: "q24", type: "radio", label: "Q24 フォトウェディングはしたいですか？", options: [
      { value: "a24-1", text: "したい" },
      { value: "a24-2", text: "相手が望むならしてもよい" },
      { value: "a24-3", text: "したくない" },
    ] },
  { id: "q25", type: "radio", label: "Q25 新婚旅行は行きたいですか？", options: [
      { value: "a25-1", text: "海外旅行に行きたい" },
      { value: "a25-2", text: "国内旅行に行きたい" },
      { value: "a25-3", text: "新婚旅行に行くことはあまり考えていない" },
    ] },
  { id: "q26", type: "radio", label: "Q26 婚前契約書の作成はしたいですか？", options: [
      { value: "a26-1", text: "作成したい" },
      { value: "a26-2", text: "特に考えたことがない" },
    ] },
  { id: "q27", type: "text",  label: "Q27 真剣交際前に告知していた以外に持病やアレルギーはありますか？もしもの時病院で家族として伝えられるように些細なことも伝えておきましょう。" },
  { id: "q28", type: "text",  label: "Q28 日常的に服薬している薬などはありますか？それらを記録しているお薬手帳もしくはスマホアプリなどをパートナーと共有しておきましょう。" },
  { id: "q29", type: "text",  label: "Q29 持病やアレルギーを抑えるための頓服薬などはありますか？ある場合はどこに保管、所持するようにしているかも教えてください。また使い方が特殊なものはパートナーが補助できるように使い方も事前に教えておきましょう。" },
  { id: "q30", type: "text",  label: "Q30 過去の既往歴、手術歴はありますか？いつも病院の問診票で書いているような、医師に伝えるべき既往歴についてパートナーとも共有しておきましょう。" },
  { id: "q31", type: "text",  label: "Q31 もしもの時、延命措置や臓器移植などの希望はありますか？パートナーにも伝えておくようにしましょう。" },
  /* Q32〜Q34：アップロードいただいたHTMLの内容をそのまま反映（3問とも同一内容）。
     本来はそれぞれ別の質問文・選択肢が入る想定とみられるため、内容確定後に要差し替え。 */
  { id: "q32", type: "radio", label: "Q32 パートナーの友人付き合いについて、どこまで関与しても平気ですか？", options: [
      { value: "a32-1", text: "パートナーの友人" },
      { value: "a32-2", text: "1シーズンに1回以上話し合う約束をしたい" },
      { value: "a32-3", text: "半年に1回以上話し合う約束をしたい" },
      { value: "a32-4", text: "1年に1回以上話し合う約束をしたい" },
      { value: "a32-5", text: "頻度は決めず、気になったときに話し合いたい" },
    ] },
  { id: "q33", type: "radio", label: "Q33 パートナーの友人付き合いについて、どこまで関与しても平気ですか？", options: [
      { value: "a33-1", text: "パートナーの友人" },
      { value: "a33-2", text: "1シーズンに1回以上話し合う約束をしたい" },
      { value: "a33-3", text: "半年に1回以上話し合う約束をしたい" },
      { value: "a33-4", text: "1年に1回以上話し合う約束をしたい" },
      { value: "a33-5", text: "頻度は決めず、気になったときに話し合いたい" },
    ] },
  { id: "q34", type: "radio", label: "Q34 パートナーの友人付き合いについて、どこまで関与しても平気ですか？", options: [
      { value: "a34-1", text: "パートナーの友人" },
      { value: "a34-2", text: "1シーズンに1回以上話し合う約束をしたい" },
      { value: "a34-3", text: "半年に1回以上話し合う約束をしたい" },
      { value: "a34-4", text: "1年に1回以上話し合う約束をしたい" },
      { value: "a34-5", text: "頻度は決めず、気になったときに話し合いたい" },
    ] },
  { id: "q35", type: "radio", label: "Q35 パートナーのSNSへ自身の写真が掲載されてもよいですか？", options: [
      { value: "a35-1", text: "掲載してもよい" },
      { value: "a35-2", text: "鍵付きのアカウントであれば掲載してもよい" },
      { value: "a35-3", text: "掲載してもよいが公開前に相談してほしい、写真のチェックをしたい" },
      { value: "a35-4", text: "顔がわからないような写真であれば写っていてもよい" },
      { value: "a35-5", text: "掲載しないでほしい" },
    ] },
  { id: "q36", type: "radio", label: "Q36 結婚後、定期的な話し合いの機会を設けますか？", options: [
      { value: "a36-1", text: "月に1回以上話し合う約束をしたい" },
      { value: "a36-2", text: "1シーズンに1回以上話し合う約束をしたい" },
      { value: "a36-3", text: "半年に1回以上話し合う約束をしたい" },
      { value: "a36-4", text: "1年に1回以上話し合う約束をしたい" },
      { value: "a36-5", text: "頻度は決めず、気になったときに話し合いたい" },
    ] },
];

/* ============================================================
   Base64URL 変換ユーティリティ（AES鍵・暗号文の符号化に使用）
   ============================================================ */
function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBuf(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = padded.length % 4;
  const fixed  = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(fixed);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* ============================================================
   SHA-256ハッシュ（LINE UserIDのハッシュ化。生IDはサーバーに送らない）
   ============================================================ */
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ============================================================
   AES-GCM 暗号化ユーティリティ
   鍵はURLのフラグメント（#以降）にのみ含め、サーバーには渡さない。
   ============================================================ */
async function generateShareKey() {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  return { key, base64: bufToBase64Url(raw) };
}

async function importShareKey(base64) {
  const raw = base64UrlToBuf(base64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function encryptJSON(obj, key) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(JSON.stringify(obj));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return bufToBase64Url(combined.buffer);
}

async function decryptJSON(base64, key) {
  const combined = new Uint8Array(base64UrlToBuf(base64));
  const iv   = combined.slice(0, 12);
  const data = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

/* ------------------------------------------------------------
   LINEユーザーIDの取得
   ------------------------------------------------------------ */
function getLineUserId() {
  const idToken = liff.getDecodedIDToken();
  if (!idToken || !idToken.sub) {
    throw new Error("ID token is not available (sub claim missing)");
  }
  return idToken.sub;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ============================================================
   ラジオ・テキスト収集ヘルパー
   ============================================================ */
function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function setRadio(name, value) {
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function getText(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined) el.value = value;
}

function radioOptionLabel(q, value) {
  if (!value) return "未回答";
  const opt = (q.options || []).find(o => o.value === value);
  return opt ? opt.text : value;
}

/* ============================================================
   詳細テキストエリアの表示・非表示
   ============================================================ */
function toggleDetail(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = show ? "block" : "none";
  if (!show) el.value = "";
}

/* ============================================================
   フォーム値の収集
   ============================================================ */
function collectFormData() {
  const data = {};
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      data[q.id] = getText(q.id);
    } else if (q.type === "radio") {
      data[q.id] = getRadio(q.id);
      if (q.detailId) data[q.detailId] = getText(q.detailId);
    }
  });
  return data;
}

/* ============================================================
   フォームへの値の復元
   ============================================================ */
function restoreFormData(data) {
  if (!data) return;
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      setText(q.id, data[q.id]);
    } else if (q.type === "radio") {
      setRadio(q.id, data[q.id]);
      if (q.detailId) setText(q.detailId, data[q.detailId]);
    }
  });
  syncAllDetailToggles();
}

/* ============================================================
   条件付き詳細欄の表示状態を同期
   ============================================================ */
function syncAllDetailToggles() {
  QUESTIONS.forEach(q => {
    if (q.type === "radio" && q.detailId) {
      const checked = getRadio(q.id);
      toggleDetail(q.detailId, q.detailShowValues.includes(checked));
    }
  });
}

function setupDetailToggles() {
  QUESTIONS.forEach(q => {
    if (q.type === "radio" && q.detailId) {
      document.querySelectorAll(`input[name="${q.id}"]`).forEach(r =>
        r.addEventListener("change", () =>
          toggleDetail(q.detailId, q.detailShowValues.includes(r.value))
        )
      );
    }
  });
}

/* ============================================================
   バリデーション（すべての設問を必須とする）
   ============================================================ */
function validate(data) {
  const errors = [];
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      if (!data[q.id] || !data[q.id].trim()) errors.push(`${q.label}`);
    } else if (q.type === "radio") {
      if (!data[q.id]) errors.push(`${q.label}`);
    }
  });
  return errors;
}

/* ============================================================
   統計用データの抽出（Analyticsシート行）
   ラジオは選択肢の表示テキストに変換し、テキスト欄はそのまま送る。
   ============================================================ */
function buildAnalyticsPayload(data) {
  const payload = {};
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      payload[q.id] = data[q.id] || "";
    } else if (q.type === "radio") {
      payload[q.id] = data[q.id] ? radioOptionLabel(q, data[q.id]) : "";
      if (q.detailId) payload[q.detailId] = data[q.detailId] || "";
    }
  });
  return payload;
}

/* ============================================================
   フォーム要素を隠す（ビューモード／状態表示に切り替える共通処理）
   ============================================================ */
function hideFormElements() {
  document.querySelectorAll(
    ".container > label, .container > input, .container > textarea, " +
    ".container > div.button-group, .container > div#shareModal, " +
    ".container > #submitBtn"
  ).forEach(el => (el.style.display = "none"));
}

/* ============================================================
   読み込み中／エラーなどの状態表示（共有リンクを開いたとき用）
   ============================================================ */
function showStateCard(title, text, isLoading = false) {
  hideFormElements();
  let container = document.getElementById("viewMode");
  if (!container) {
    container = document.createElement("div");
    container.id = "viewMode";
    document.querySelector(".container").prepend(container);
  }
  container.style.display = "block";
  container.innerHTML = `
    <div class="view-header state-card">
      ${isLoading ? `
        <div class="state-spinner">
          <img src="https://developers.line.biz/media/line-mini-app/LINE_spinner_light.svg" class="spinner-light" alt="読み込み中">
          <img src="https://developers.line.biz/media/line-mini-app/LINE_spinner_dark.svg" class="spinner-dark" alt="読み込み中">
        </div>
      ` : ""}
      <p class="view-label">${escapeHTML(title)}</p>
      <p class="state-text">${escapeHTML(text)}</p>
    </div>
  `;
}

/* ============================================================
   共有リンクを開いたときの処理
   ============================================================ */
async function handleSharedView(id) {
  showStateCard("読み込み中…", "回答内容を確認しています。少々お待ちください。", true);

  const keyBase64 = location.hash ? location.hash.slice(1) : "";
  if (!keyBase64) {
    showStateCard(
      "リンクが不完全です",
      "共有リンクが途中で切れているか、正しくコピーされていない可能性があります。共有した相手にもう一度リンクを送ってもらってください。"
    );
    return;
  }

  if (!liff.isLoggedIn()) {
    try {
      sessionStorage.setItem(PENDING_SHARED_VIEW_KEY, location.href);
    } catch (_) {}
    liff.login();
    return;
  }

  let key;
  try {
    key = await importShareKey(keyBase64);
  } catch (e) {
    console.error("key import error", e);
    showStateCard("リンクが正しくありません", "共有リンクが壊れている可能性があります。");
    return;
  }

  let viewerHash;
  try {
    const userId = getLineUserId();
    viewerHash = await sha256Hex(userId);
  } catch (e) {
    console.error("get user id error", e);
    showStateCard(
      "エラー",
      "LINEアカウント情報の確認に失敗しました。時間をおいてもう一度お試しください。" +
      "（詳細: " + (e && e.message ? e.message : String(e)) + "）"
    );
    return;
  }

  let result;
  try {
    const url = `${GAS_ENDPOINT}?action=view&id=${encodeURIComponent(id)}&viewerHash=${encodeURIComponent(viewerHash)}`;
    const resp = await fetch(url, { method: "GET" });
    result = await resp.json();
  } catch (e) {
    console.error("fetch view error", e);
    showStateCard("通信エラー", "回答内容を取得できませんでした。通信環境を確認してもう一度お試しください。");
    return;
  }

  if (!result.ok) {
    if (result.reason === "forbidden" || result.reason === "partner_locked") {
      showStateCard(
        "閲覧できません",
        "このリンクは最初に開いた方専用です。転送されたリンクは、その方以外は閲覧できない仕組みになっています。"
      );
    } else if (result.reason === "revoked" || result.reason === "expired" || result.reason === "deleted") {
      showStateCard("リンクが無効です", "このリンクはすでに無効になっています。最新の共有リンクを送ってもらってください。");
    } else if (result.reason === "not_found") {
      showStateCard("リンクが見つかりません", "このリンクは存在しないか、削除された可能性があります。");
    } else {
      showStateCard("エラー", "回答内容を取得できませんでした。時間をおいて再度お試しください。");
    }
    return;
  }

  let data;
  try {
    data = await decryptJSON(result.cipherText, key);
  } catch (e) {
    console.error("decrypt error", e);
    showStateCard("復号に失敗しました", "リンクの一部が正しくない可能性があります。共有した相手にもう一度リンクを送ってもらってください。");
    return;
  }

  renderViewMode(data);
  showScreenshotWatermark(viewerHash);
}

/* ============================================================
   ビューモード：回答をカード表示
   ============================================================ */
function renderViewMode(data, options = {}) {
  const { selfPreview = false, onShare = null } = options;

  const rows = QUESTIONS.map(q => {
    if (q.type === "text") {
      return { q: q.label, a: data[q.id] || "未回答" };
    }
    const base = radioOptionLabel(q, data[q.id]);
    const detail = q.detailId && data[q.detailId] && data[q.detailId].trim()
      ? `<br>${escapeHTML(data[q.detailId])}`
      : "";
    return { q: q.label, html: (data[q.id] ? escapeHTML(base) : "未回答") + detail };
  });

  hideFormElements();

  const formURL = location.href.split("?")[0].split("#")[0];

  const descEl = document.querySelector(".form-header .form-description");
  if (descEl) {
    descEl.innerHTML =
      "回答を共有してお互いのことを知りましょう。<br>" +
      "回答内容だけじゃなく、なぜそう思ってるのか、この場合はどう変わるかなども質問し合ってみましょう。";
  }

  let container = document.getElementById("viewMode");
  if (!container) {
    container = document.createElement("div");
    container.id = "viewMode";
    document.querySelector(".container").prepend(container);
  }
  container.style.display = "block";

  container.innerHTML = `
    ${selfPreview ? `
    <div class="cta-card share-confirm-card">
      <div class="cta-content" style="text-align:center;">
        <h3 class="cta-title">この内容を共有します</h3>
        <p class="cta-text">内容を確認したら、共有先を選んでください。</p>
        <button type="button" id="goShareBtn" class="cta-button">
          共有先を選ぶ <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : `
    <div class="view-header">
      <p class="view-label">回答内容</p>
      ${data._shareName ? `<p class="view-name">${escapeHTML(data._shareName)} さんの回答</p>` : ""}
    </div>
    `}

    ${rows.map(({ q, a, html }) => `
      <div class="view-item">
        <p class="view-question">${escapeHTML(q)}</p>
        <p class="view-answer">${html !== undefined ? html : escapeHTML(a).replace(/\n/g, "<br>")}</p>
      </div>
    `).join("")}

    ${!selfPreview ? `
    <div class="cta-card">
      <img src="shareimage.webp" class="cta-image-left" alt="">
      <div class="cta-content">
        <h3 class="cta-title">あなたの価値観も共有してみませんか？</h3>
        <p class="cta-text">
          価値観のすり合わせは、<br>
          お互いを知る大切なきっかけになります。<br>
          あなたの考えや価値観をアンケートで伝えてみましょう。
        </p>
        <button type="button" id="ctaButton" class="cta-button" data-href="${formURL}">
          私も回答する <span class="cta-arrow">›</span>
        </button>
      </div>
    </div>
    ` : ""}
  `;

  if (selfPreview) {
    const goShareBtn = document.getElementById("goShareBtn");
    if (goShareBtn && typeof onShare === "function") {
      goShareBtn.addEventListener("click", onShare);
    }
    return;
  }

  const ctaButton = document.getElementById("ctaButton");
  if (ctaButton) {
    ctaButton.addEventListener("click", () => {
      if (confirm("婚約前の確認フォームを開く")) {
        window.location.href = ctaButton.dataset.href;
      }
    });
  }
}

/* ============================================================
   共有：シェアターゲットピッカー用 Flexメッセージ
   ============================================================ */
const SHARETARGETPICKER_IMAGE_URL = "https://example.com/sharetargetpicker.jpg"; // ← 公開済みhttps画像URLに差し替える

function buildShareFlexMessage(shareName, shareURL) {
  const nameLine = shareName ? `${shareName}さんの回答が届きました` : "回答が届きました";

  return {
    type: "flex",
    altText: `婚約前の確認 - ${nameLine}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: SHARETARGETPICKER_IMAGE_URL,
        size: "full",
        aspectRatio: "3:2",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "婚約前の確認", size: "xs", weight: "bold", color: "#d96c7d" },
          { type: "text", text: nameLine, size: "lg", weight: "bold", wrap: true, margin: "sm" },
          { type: "text", text: "ボタンから回答内容を確認できます。", size: "sm", color: "#888888", wrap: true, margin: "md" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "20px",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#f48ca0",
            action: { type: "uri", label: "回答をみる", uri: shareURL }
          }
        ]
      }
    }
  };
}

/* ------------------------------------------------------------
   スクショ抑止用ウォーターマーク
   ------------------------------------------------------------ */
function buildWatermarkSVG(lines) {
  const tileW = 240, tileH = 140;
  const lineHeight = 16;
  const startY = tileH / 2 - ((lines.length - 1) * lineHeight) / 2;

  const textEls = lines.map((line, i) => {
    const y = startY + i * lineHeight;
    return `<text x="0" y="${y}" font-size="12" font-family="sans-serif" ` +
           `fill="rgba(0,0,0,0.1)" transform="rotate(-28 ${tileW / 2} ${tileH / 2})">${escapeHTML(line)}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${tileH}">${textEls}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function showScreenshotWatermark(viewerHash) {
  const el = document.getElementById("screenshotWatermark");
  if (!el) return;
  const stamp = new Date().toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const lines = [
    "スクショ・転載禁止",
    `${viewerHash.slice(0, 8)}  ${stamp}`,
  ];
  el.style.backgroundImage = `url("${buildWatermarkSVG(lines)}")`;
  el.classList.add("show");
}

/* ============================================================
   共有先を選んで送信する
   ============================================================ */
async function shareToOthers(flexMessage, fallbackLineSchemeURL) {
  if (liff.isApiAvailable("shareTargetPicker")) {
    try {
      await liff.shareTargetPicker([flexMessage], { isMultiple: true });
      return;
    } catch (e) {
      console.warn("shareTargetPicker failed, falling back to URL scheme:", e);
    }
  }

  if (liff.isInClient()) {
    window.location.href = fallbackLineSchemeURL;
  } else {
    window.open(fallbackLineSchemeURL, "_blank");
  }
}

/* ============================================================
   友だち追加チェック
   ============================================================ */
async function checkFriendship() {
  try {
    const friendship = await liff.getFriendship();
    if (!friendship.friendFlag) {
      try {
        await liff.requestFriendship();
      } catch (error) {
        console.warn("友だち追加リクエスト失敗（ユーザーがキャンセルした可能性があります）:", error);
      }
    }
  } catch (error) {
    console.warn("友だち確認をスキップ:", error);
  }
}

/* ============================================================
   複数アプリ一括下書き移行チェーン 受け取り処理
   （価値観すり合わせシリーズ共通スニペット。中身は全サイト同一）
   ============================================================ */
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get("migrate") !== "1" || !location.hash) return;

  window.__migrationInProgress = true;

  try {
    const idx = parseInt(params.get("idx") || "0", 10);
    const encoded = location.hash.slice(1);
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const chain = JSON.parse(new TextDecoder().decode(bytes));

    const item = chain[idx];
    if (item && item.value != null) {
      localStorage.setItem(item.draftKey, item.value);
    }

    const next = chain[idx + 1];
    if (next) {
      location.href = `${next.targetOrigin}?migrate=1&idx=${idx + 1}#${encoded}`;
    } else {
      alert("下書きデータの移行がすべて完了しました。");
      history.replaceState(null, "", location.origin + location.pathname);
      window.__migrationInProgress = false;
    }
  } catch (e) {
    console.error("draft migration failed", e);
    alert("下書きデータの移行中にエラーが発生しました。お手数ですが運営までご連絡ください。");
    history.replaceState(null, "", location.origin + location.pathname);
    window.__migrationInProgress = false;
  }
})();

/* ============================================================
   メイン処理
   ============================================================ */
(async () => {

  if (window.__migrationInProgress) return;

  try {
    await liff.init({ liffId: LIFF_ID });
  } catch (e) {
    console.error("LIFF init failed", e);
    alert("LIFFの初期化に失敗しました。");
    return;
  }

  let sharedId = new URLSearchParams(location.search).get("id");
  if (!sharedId) {
    try {
      const pending = sessionStorage.getItem(PENDING_SHARED_VIEW_KEY);
      if (pending) {
        const pendingURL = new URL(pending);
        const pendingId = new URLSearchParams(pendingURL.search).get("id");
        if (pendingId) {
          sharedId = pendingId;
          const restoredHash = location.hash || pendingURL.hash;
          history.replaceState(null, "", location.pathname + pendingURL.search + restoredHash);
        }
      }
    } catch (_) {}
  }
  try { sessionStorage.removeItem(PENDING_SHARED_VIEW_KEY); } catch (_) {}

  if (sharedId) {
    await handleSharedView(sharedId);
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }

  checkFriendship();

  /* ----- 条件付き表示（Q11・Q12 の詳細欄）の初期化 ----- */
  setupDetailToggles();

  /* ----- localStorage から下書き復元 ----- */
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) restoreFormData(JSON.parse(saved));
  } catch (_) {}
  syncAllDetailToggles();

  /* ----- 下書き保存 ----- */
  document.getElementById("draftBtn") &&
  document.getElementById("draftBtn").addEventListener("click", () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectFormData()));
      alert("下書きを保存しました。");
    } catch (_) {
      alert("下書きの保存に失敗しました。");
    }
  });

  /* ----- フォームクリア ----- */
  document.getElementById("clearBtn") &&
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("入力内容をすべてクリアしますか？")) return;

    document.querySelectorAll(".detail-textarea").forEach(el => (el.value = ""));
    document.querySelectorAll('input[type="radio"]').forEach(el => (el.checked = false));
    syncAllDetailToggles();

    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
  });

  /* ----- 送信ボタン ----- */
  document.getElementById("submitBtn").addEventListener("click", () => {
    const data   = collectFormData();
    const errors = validate(data);

    if (errors.length > 0) {
      alert("以下の項目を入力・選択してください。\n\n" + errors.join("\n"));
      return;
    }

    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (_) {}

    const modal = document.getElementById("shareModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("show");
      document.getElementById("submitBtn").disabled = true;
    } else {
      handleShare(data, "").catch(e => {
        console.error("share error", e);
        alert("共有の準備に失敗しました。通信環境を確認してもう一度お試しください。");
      });
    }
  });

  /* ----- 共有ボタン（モーダルあり） ----- */
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const shareName = (document.getElementById("shareName") || {}).value || "";
      const data      = collectFormData();

      shareBtn.disabled = true;
      const originalLabel = shareBtn.textContent;
      shareBtn.textContent = "送信中…";

      try {
        await handleShare(data, shareName.trim());

        const modal = document.getElementById("shareModal");
        if (modal) {
          modal.classList.remove("show");
          modal.classList.add("hidden");
        }
      } catch (e) {
        console.error("share error", e);
        alert("共有の準備に失敗しました。通信環境を確認してもう一度お試しください。");
        document.getElementById("submitBtn").disabled = false;
      } finally {
        shareBtn.disabled = false;
        shareBtn.textContent = originalLabel;
      }
    });
  }

  /* ----- モーダル外クリックで閉じる ----- */
  const shareModal = document.getElementById("shareModal");
  if (shareModal) {
    shareModal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove("show");
        e.currentTarget.classList.add("hidden");
        document.getElementById("submitBtn").disabled = false;
      }
    });
  }

})();

/* ============================================================
   共有処理（送信ボタン・共有ボタン共通）
   ============================================================ */
async function handleShare(data, shareName) {
  data._shareName = shareName;

  const userId    = getLineUserId();
  const ownerHash = await sha256Hex(userId);

  const id = (crypto.randomUUID ? crypto.randomUUID() : fallbackUUID());
  const { key, base64: keyBase64 } = await generateShareKey();
  const cipherText = await encryptJSON(data, key);
  const analytics  = buildAnalyticsPayload(data);

  const resp = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // preflight回避のため text/plain を使用
    body: JSON.stringify({ action: "share", id, cipherText, ownerHash, analytics, schemaVersion: 1 }),
  });
  const result = await resp.json();
  if (!result.ok) throw new Error(result.reason || "share_failed");

  const base     = location.href.split("?")[0].split("#")[0];
  const shareURL = `${base}?id=${id}#${keyBase64}`;

  const previewMsg = shareName
    ? `${shareName}さんの婚約前の確認の回答が届きました。\n回答をみる→${shareURL}`
    : `婚約前の確認の回答が届きました。\n回答をみる→${shareURL}`;

  const flexMessage = buildShareFlexMessage(shareName, shareURL);

  renderViewMode(data, {
    selfPreview: true,
    onShare: () => {
      const lineShareURL = `https://line.me/R/msg/text/?${encodeURIComponent(previewMsg)}`;
      shareToOthers(flexMessage, lineShareURL);
    },
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* crypto.randomUUID が使えない古い環境用のフォールバック */
function fallbackUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
