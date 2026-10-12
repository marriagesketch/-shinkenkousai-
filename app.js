/* ============================================================
   婚約前の確認 – app.js（自動ペア判定方式）
   ------------------------------------------------------------
   住まい すり合わせ（house）と同じ自動ペア判定方式を採用。
   ・共有リンクの送付・暗号キーの入力は一切不要。
   ・サーバーに送るのは ownerHash（LINE userIdのSHA-256）だけ。
   ・GASが毎回 Partners中央API に ownerHash を問い合わせ、
     「現在の真剣交際パートナー」「ペア専用の暗号鍵材料(pairKey)」
     「お相手の表示名(partnerDisplayName)」を取得して返す。
   ・pairKeyの生値は画面に出さず、ブラウザ上でAES鍵の導出にのみ使う。
   ・パートナー未登録（または交際終了）の場合は、パートナー登録への
     リンクボタンを表示して、本体は開かない。
   ・プレビューは「自分」「お相手」の2つ。お相手側は閲覧専用で編集不可。
   ・「送信する」を押すまでは回答はこの端末にしか保存されず、
     お相手には届かない。
   ============================================================ */

const LIFF_ID = "2010312230-yRtDTHxa";
const DRAFT_KEY = "konyaku_zenno_kakunin_draft";

// ▼▼▼ デプロイ済みGAS Web AppのURL（code.gs を新バージョンとして再デプロイした /exec URL）▼▼▼
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxVMevWWyHLFcNiTIN-zyad4uZOMuVCxlipFJrMDPXYZQSSXnI7tZaicDAc1zNMfDAAOA/exec";

// ▼▼▼ パートナー登録（真剣交際パートナー機能）のLIFF URL ▼▼▼
const PARTNER_REGISTRATION_URL = "https://liff.line.me/2010312230-xUsYz0UB";

/* ============================================================
   質問定義（HTML・app.js・code.gs で質問番号を統一するための唯一の情報源）
   type: "text"  … textarea 1つのみ（noAnswerValue があれば「回答しない」チェック付き）
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
      { value: "a4-4", text: "回答しない" },
    ] },
  { id: "q5",  type: "text",  label: "Q5 将来は何歳くらいまで働きたいですか？定年後も再雇用や非正規雇用で働き続けたいですか？", noAnswerValue: "a5_no" },
  { id: "q6",  type: "text",  label: "Q6 将来、自分の親の介護が必要になった場合の現時点での計画はありますか？", noAnswerValue: "a6_no" },
  { id: "q7",  type: "text",  label: "Q7 年収はいくらですか？今年の見込み年収を教えてください。副業があれば、本業、副業それぞれいくらかも教えてください。", noAnswerValue: "a7_no" },
  { id: "q8",  type: "text",  label: "Q8 貯金はいくらありますか？現金での貯金額を教えてください。", noAnswerValue: "a8_no" },
  { id: "q9",  type: "text",  label: "Q9 株などの金融資産や不動産など、現金以外での貯蓄があれば、何を持っているか、必要であれば現金化できるようなものか教えてください。", noAnswerValue: "a9_no" },
  { id: "q10", type: "text",  label: "Q10 現在の支出状況について教えてください。", noAnswerValue: "a10_no" },
  { id: "q11", type: "radio", label: "Q11 お金の管理方法はどうしたいですか？", detailId: "q11Detail", detailShowValues: ["a11-4"], options: [
      { value: "a11-1", text: "どちらかに管理をお願いし、お小遣い制にする" },
      { value: "a11-2", text: "共同口座を作り、生活費や将来のための貯蓄を定期的にお互い入金する" },
      { value: "a11-3", text: "原則それぞれで管理し、支出が必要になるタイミングで支払う" },
      { value: "a11-4", text: "その他" },
      { value: "a11_no", text: "回答しない" },
    ] },
  { id: "q12", type: "radio", label: "Q12 大きい買い物をするときは個人の買い物であっても相談したいですか？", detailId: "q12Detail", detailLabelId: "q12DetailLabel", detailShowValues: ["a12-1"], options: [
      { value: "a12-1", text: "大きい額のときは相談したい、してほしい" },
      { value: "a12-2", text: "個人の買い物は相談しなくてよい" },
      { value: "a12_no", text: "回答しない" },
    ] },
  { id: "q13", type: "text",  label: "Q13 毎月どれくらい貯蓄したいですか？", noAnswerValue: "a13_no" },
  { id: "q14", type: "text",  label: "Q14 投資はしたいですか？", noAnswerValue: "a14_no" },
  { id: "q15", type: "text",  label: "Q15 保険への加入や、すでに加入している方はプランの変更など考えていますか？", noAnswerValue: "a15_no" },
  { id: "q16", type: "text",  label: "Q16 現在の勤め先で、結婚休暇などの結婚支援制度はありますか？あれば具体的に教えてください。", noAnswerValue: "a16_no" },
  { id: "q17", type: "text",  label: "Q17 現在の勤め先で、出産・育児支援制度はどんなものがありますか？", noAnswerValue: "a17_no" },
  { id: "q18", type: "text",  label: "Q18 死亡時や働けなくなった時、会社独自の給与補償のようなものはありますか？", noAnswerValue: "a18_no" },
  { id: "q19", type: "radio", label: "Q19 ベッド、寝室について理想はありますか？", options: [
      { value: "a19-1", text: "大きめのベッドで一緒に寝たい" },
      { value: "a19-2", text: "同じ寝室でベッドは分けたい" },
      { value: "a19-3", text: "寝室を分けたい" },
      { value: "a19_no", text: "回答しない" },
    ] },
  { id: "q20", type: "radio", label: "Q20 結納や両家顔合わせはしますか？", options: [
      { value: "a20-1", text: "したい" },
      { value: "a20-2", text: "するつもりはないがお相手次第" },
      { value: "a20-3", text: "自身の両親と話していないので後日相談させてほしい" },
      { value: "a20_no", text: "回答しない" },
    ] },
  { id: "q21", type: "radio", label: "Q21 婚約指輪はほしいですか？もしくはあげたいですか？", options: [
      { value: "a21-1", text: "ほしい、もしくはあげたい" },
      { value: "a21-2", text: "相手が望むならあげたい" },
      { value: "a21-3", text: "ほしくない、もしくはあげたくない" },
      { value: "a21_no", text: "回答しない" },
    ] },
  { id: "q22", type: "radio", label: "Q22 結婚指輪はほしいですか？", options: [
      { value: "a22-1", text: "ほしい" },
      { value: "a22-2", text: "相手が望むならほしい" },
      { value: "a22-3", text: "自分はいらないが、相手が望むなら相手の分はあげたい" },
      { value: "a22-4", text: "自分はほしいが、相手の分は相手の意思に任せる" },
      { value: "a22-5", text: "ほしくないし、あげたくもない" },
      { value: "a22_no", text: "回答しない" },
    ] },
  { id: "q23", type: "radio", label: "Q23 結婚式はしたいですか？", options: [
      { value: "a23-1", text: "したい" },
      { value: "a23-2", text: "相手が望むならしてもよい" },
      { value: "a23-3", text: "したくない" },
      { value: "a23_no", text: "回答しない" },
    ] },
  { id: "q24", type: "radio", label: "Q24 フォトウェディングはしたいですか？", options: [
      { value: "a24-1", text: "したい" },
      { value: "a24-2", text: "相手が望むならしてもよい" },
      { value: "a24-3", text: "したくない" },
      { value: "a24_no", text: "回答しない" },
    ] },
  { id: "q25", type: "radio", label: "Q25 新婚旅行は行きたいですか？", options: [
      { value: "a25-1", text: "海外旅行に行きたい" },
      { value: "a25-2", text: "国内旅行に行きたい" },
      { value: "a25-3", text: "新婚旅行に行くことはあまり考えていない" },
      { value: "a25_no", text: "回答しない" },
    ] },
  { id: "q26", type: "radio", label: "Q26 婚前契約書の作成はしたいですか？", options: [
      { value: "a26-1", text: "作成したい" },
      { value: "a26-2", text: "特に考えたことがない" },
      { value: "a26_no", text: "回答しない" },
    ] },
  { id: "q27", type: "text",  label: "Q27 真剣交際前に告知していた以外に持病やアレルギーはありますか？もしもの時病院で家族として伝えられるように些細なことも伝えておきましょう。", noAnswerValue: "a27_no" },
  { id: "q28", type: "text",  label: "Q28 日常的に服薬している薬などはありますか？それらを記録しているお薬手帳もしくはスマホアプリなどをパートナーと共有しておきましょう。", noAnswerValue: "a28_no" },
  { id: "q29", type: "text",  label: "Q29 持病やアレルギーを抑えるための頓服薬などはありますか？ある場合はどこに保管、所持するようにしているかも教えてください。また使い方が特殊なものはパートナーが補助できるように使い方も事前に教えておきましょう。", noAnswerValue: "a29_no" },
  { id: "q30", type: "text",  label: "Q30 過去の既往歴、手術歴はありますか？いつも病院の問診票で書いているような、医師に伝えるべき既往歴についてパートナーとも共有しておきましょう。", noAnswerValue: "a30_no" },
  { id: "q31", type: "text",  label: "Q31 もしもの時、延命措置や臓器移植などの希望はありますか？パートナーにも伝えておくようにしましょう。", noAnswerValue: "a31_no" },
  { id: "q32", type: "radio", label: "Q32 義家族付き合いについて、どこまで関与しても平気ですか？", options: [
      { value: "a32-1", text: "義家族とも積極的に交流したい" },
      { value: "a32-2", text: "積極的に関わりたいわけではないが、義家族も交えて遊んだり家に来てもよい" },
      { value: "a32-3", text: "義家族が家に遊びに来てもよいが、そのときは外出するなどあまり会いたくはない" },
      { value: "a32-4", text: "義家族はあまり家にきてほしくない" },
      { value: "a32_no", text: "回答しない" },
    ] },
  { id: "q33", type: "radio", label: "Q33 パートナーの友人付き合いについて、どこまで関与しても平気ですか？", options: [
      { value: "a33-1", text: "パートナーの友人とも積極的に交流したい" },
      { value: "a33-2", text: "積極的に関わりたいわけではないが、パートナーの友人も交えて遊んだり家に来てもよい" },
      { value: "a33-3", text: "パートナーの友人が家に遊びに来てもよいが、そのときは外出するなどあまり会いたくはない" },
      { value: "a33-4", text: "パートナーの友人はあまり家にきてほしくない" },
      { value: "a33_no", text: "回答しない" },
    ] },
  { id: "q34", type: "radio", label: "Q34 パートナーのSNSへ自身の写真が掲載されてもよいですか？", options: [
      { value: "a34-1", text: "掲載してもよい" },
      { value: "a34-2", text: "鍵付きのアカウントであれば掲載してもよい" },
      { value: "a34-3", text: "掲載してもよいが公開前に相談してほしい、写真のチェックをしたい" },
      { value: "a34-4", text: "顔がわからないような写真であれば写っていてもよい" },
      { value: "a34-5", text: "掲載しないでほしい" },
      { value: "a34_no", text: "回答しない" },
    ] },
  { id: "q35", type: "radio", label: "Q35 結婚後、定期的な話し合いの機会を設けますか？", options: [
      { value: "a35-1", text: "月に1回以上話し合う約束をしたい" },
      { value: "a35-2", text: "1シーズンに1回以上話し合う約束をしたい" },
      { value: "a35-3", text: "半年に1回以上話し合う約束をしたい" },
      { value: "a35-4", text: "1年に1回以上話し合う約束をしたい" },
      { value: "a35-5", text: "頻度は決めず、気になったときに話し合いたい" },
      { value: "a35_no", text: "回答しない" },
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
   暗号鍵材料（pairKey）からのAES鍵導出
   ・pairKeyの生値はfetchPairの応答で自動的に受け取る。
     ユーザーが目にしたり入力したりすることはない。
   ・他アプリとpairKeyが共通でも、プレフィックスをアプリごとに
     変えることで、アプリをまたいで同じ鍵が再利用されないようにする。
   ============================================================ */
async function deriveAesKey(pairKey) {
  const material = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode("konyaku-zenno-kakunin-cipher:" + pairKey));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/* ============================================================
   AES-GCM 暗号化ユーティリティ
   ============================================================ */
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
   詳細テキストエリア（＋付随ラベル）の表示・非表示
   q.detailId は必須、q.detailLabelId があれば一緒に表示切替する
   （例: Q12の「いくら以上ですか？」ラベル）。
   ============================================================ */
function toggleDetailGroup(q, show) {
  const ids = [q.detailId];
  if (q.detailLabelId) ids.push(q.detailLabelId);
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? "block" : "none";
  });
  if (!show) {
    const ta = document.getElementById(q.detailId);
    if (ta) ta.value = "";
  }
}

/* ============================================================
   フォーム値の収集
   ・text かつ noAnswerValue が設定されている設問は、
     「回答しない」ラジオが選択されていればその値を、
     そうでなければテキストエリアの内容を採用する。
   ============================================================ */
function collectFormData() {
  const data = {};
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      if (q.noAnswerValue && isNoAnswerChecked(q)) {
        data[q.id] = q.noAnswerValue;
      } else {
        data[q.id] = getText(q.id);
      }
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
      if (q.noAnswerValue && data[q.id] === q.noAnswerValue) {
        setNoAnswerChecked(q, true);
        setText(q.id, "");
      } else {
        setNoAnswerChecked(q, false);
        setText(q.id, data[q.id]);
      }
    } else if (q.type === "radio") {
      setRadio(q.id, data[q.id]);
      if (q.detailId) setText(q.detailId, data[q.detailId]);
    }
  });
  syncAllDetailToggles();
  syncAllNoAnswerToggles();
}

/* ============================================================
   条件付き詳細欄の表示状態を同期
   ============================================================ */
function syncAllDetailToggles() {
  QUESTIONS.forEach(q => {
    if (q.type === "radio" && q.detailId) {
      const checked = getRadio(q.id);
      toggleDetailGroup(q, q.detailShowValues.includes(checked));
    }
  });
}

function setupDetailToggles() {
  QUESTIONS.forEach(q => {
    if (q.type === "radio" && q.detailId) {
      document.querySelectorAll(`input[name="${q.id}"]`).forEach(r =>
        r.addEventListener("change", () =>
          toggleDetailGroup(q, q.detailShowValues.includes(r.value))
        )
      );
    }
  });
}

/* ============================================================
   「回答しない」チェックボックス ⇔ テキストエリアの表示制御（text型のみ）
   ・デフォルトはテキストエリアを表示
   ・「回答しない」にチェックすると、テキストエリアを空にして非表示にする
   ・チェックを外すとテキストエリアを再表示する
   ============================================================ */
function getNoAnswerEl(q) {
  return document.querySelector(
    `input[type="checkbox"][name="${q.id}"][value="${q.noAnswerValue}"]`
  );
}

function isNoAnswerChecked(q) {
  const el = getNoAnswerEl(q);
  return !!(el && el.checked);
}

function setNoAnswerChecked(q, checked) {
  const el = getNoAnswerEl(q);
  if (el) el.checked = checked;
}

function applyNoAnswerVisibility(q) {
  const textarea = document.getElementById(q.id);
  if (!textarea) return;
  if (isNoAnswerChecked(q)) {
    textarea.value = "";
    textarea.style.display = "none";
  } else {
    textarea.style.display = "";
  }
}

function syncAllNoAnswerToggles() {
  QUESTIONS.forEach(q => {
    if (q.type === "text" && q.noAnswerValue) applyNoAnswerVisibility(q);
  });
}

function setupNoAnswerToggles() {
  QUESTIONS.forEach(q => {
    if (q.type !== "text" || !q.noAnswerValue) return;
    const el = getNoAnswerEl(q);
    if (!el) return;
    el.addEventListener("change", () => applyNoAnswerVisibility(q));
  });
}

/* ============================================================
   統計用データの抽出（Analyticsシート行）
   ラジオは選択肢の表示テキストに変換し、テキスト欄はそのまま送る。
   「回答しない」が選ばれた場合は "回答しない" という文字列にする。
   ============================================================ */
function buildAnalyticsPayload(data) {
  const payload = {};
  QUESTIONS.forEach(q => {
    if (q.type === "text") {
      payload[q.id] = (q.noAnswerValue && data[q.id] === q.noAnswerValue)
        ? "回答しない"
        : (data[q.id] || "");
    } else if (q.type === "radio") {
      payload[q.id] = data[q.id] ? radioOptionLabel(q, data[q.id]) : "";
      if (q.detailId) payload[q.detailId] = data[q.detailId] || "";
    }
  });
  return payload;
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

function hideScreenshotWatermark() {
  const el = document.getElementById("screenshotWatermark");
  if (el) el.classList.remove("show");
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
   下書き保存／復元（この端末の中だけ。お相手には届かない）
   ============================================================ */
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectFormData()));
    flashSaved();
  } catch (e) { console.warn("draft save failed", e); }
}

function flashSaved() {
  const b = document.getElementById("saveStatus");
  if (!b) return;
  b.classList.add("just-saved");
  setTimeout(() => b.classList.remove("just-saved"), 400);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    restoreFormData(JSON.parse(raw));
  } catch (e) { console.warn("draft load failed", e); }
}

/* ============================================================
   ペア状態（パートナー登録確認・自分／お相手の回答）
   ============================================================ */
const AppState = {
  ownerHash: null,
  aesKey: null,
  partnerDisplayName: "",
  ownSubmittedAt: null,     // 自分が最後に送信した日時（未送信ならnull）
  partnerCipherText: null,  // お相手の暗号化データ（未送信ならnull）
  partnerUpdatedAt: null,
};

async function fetchPair(ownerHash) {
  const url = `${GAS_ENDPOINT}?action=fetchPair&ownerHash=${encodeURIComponent(ownerHash)}`;
  const resp = await fetch(url, { method: "GET" });
  return resp.json();
}

async function submitOwnData() {
  const data = collectFormData();
  const cipherText = await encryptJSON(data, AppState.aesKey);
  const analytics  = buildAnalyticsPayload(data);
  const resp = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // preflight回避のため text/plain を使用
    body: JSON.stringify({ action: "submit", ownerHash: AppState.ownerHash, cipherText, analytics }),
  });
  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "(本文を取得できませんでした)");
    console.error(`submit failed: HTTP ${resp.status} ${resp.statusText}`, bodyText);
    throw new Error(`http_${resp.status}`);
  }
  const result = await resp.json();
  if (!result.ok) throw new Error(result.reason || "submit_failed");
  AppState.ownSubmittedAt = result.updatedAt || new Date().toISOString();
  return result;
}

/* ============================================================
   状態表示（パートナー確認中・エラーなど）
   ============================================================ */
function showAppState(title, text, isLoading = false) {
  document.getElementById("app").style.display = "none";
  document.getElementById("partnerRequired").style.display = "none";
  const pv = document.getElementById("publicView");
  pv.style.display = "block";
  pv.innerHTML = `
    <div class="state-card">
      ${isLoading ? `
        <div class="state-spinner">
          <img src="https://developers.line.biz/media/line-mini-app/LINE_spinner_light.svg" class="spinner-light" alt="読み込み中">
          <img src="https://developers.line.biz/media/line-mini-app/LINE_spinner_dark.svg" class="spinner-dark" alt="読み込み中">
        </div>
      ` : ""}
      <p class="state-title">${escapeHTML(title)}</p>
      <p class="state-text">${escapeHTML(text)}</p>
    </div>
  `;
}

function showPartnerRequired() {
  document.getElementById("app").style.display = "none";
  document.getElementById("publicView").style.display = "none";
  hideScreenshotWatermark();
  document.getElementById("partnerRequired").style.display = "block";
}

function showApp() {
  document.getElementById("publicView").style.display = "none";
  document.getElementById("partnerRequired").style.display = "none";
  document.getElementById("app").style.display = "";
}

function updatePartnerTabLabel() {
  const btn = document.getElementById("partnerTabBtn");
  if (btn) btn.textContent = AppState.partnerDisplayName ? `${AppState.partnerDisplayName}さん` : "お相手";
}

/* ============================================================
   パートナー登録確認（自動ペア判定）
   ============================================================ */
async function initPairing() {
  showAppState("読み込み中…", "パートナー登録の状況を確認しています。少々お待ちください。", true);

  let ownerHash;
  try {
    ownerHash = await sha256Hex(getLineUserId());
  } catch (e) {
    console.error("get user id failed", e);
    showAppState("読み込みに失敗しました", "LINEアカウント情報を確認できませんでした。時間をおいてもう一度開き直してください。");
    return false;
  }
  AppState.ownerHash = ownerHash;

  let result;
  try {
    result = await fetchPair(ownerHash);
  } catch (e) {
    console.error("fetchPair failed", e);
    showAppState("読み込みに失敗しました", "時間をおいてもう一度開き直してください。");
    return false;
  }

  if (!result.ok) {
    if (result.reason === "no_partner" || result.reason === "partner_ended") {
      showPartnerRequired();
    } else {
      showAppState("読み込みに失敗しました", "時間をおいてもう一度開き直してください。");
    }
    return false;
  }

  AppState.aesKey             = await deriveAesKey(result.pairKey);
  AppState.partnerDisplayName = result.partnerDisplayName || "";
  AppState.ownSubmittedAt     = result.own ? result.own.updatedAt : null;
  AppState.partnerCipherText  = result.partner ? result.partner.cipherText : null;
  AppState.partnerUpdatedAt   = result.partner ? result.partner.updatedAt : null;

  updatePartnerTabLabel();
  showApp();
  return true;
}

/* ペア情報だけを取り直す（画面遷移はせず、お相手の最新状況だけ更新） */
async function refetchPair() {
  let result;
  try {
    result = await fetchPair(AppState.ownerHash);
  } catch (e) {
    console.error("refetchPair failed", e);
    alert("お相手の状況を取得できませんでした。通信環境を確認してもう一度お試しください。");
    return false;
  }
  if (!result.ok) {
    showPartnerRequired(); // 取得中に交際終了などがあった場合は案内画面に戻す
    return false;
  }
  AppState.partnerDisplayName = result.partnerDisplayName || "";
  AppState.partnerCipherText  = result.partner ? result.partner.cipherText : null;
  AppState.partnerUpdatedAt   = result.partner ? result.partner.updatedAt : null;
  updatePartnerTabLabel();
  return true;
}

/* ============================================================
   表示用 HTML ビルダー（自分／お相手 共通のQ&A表示。入力欄は一切出さない）
   ============================================================ */
function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function buildQARowsHTML(data) {
  return QUESTIONS.map(q => {
    let html;
    if (q.type === "text") {
      const v = data[q.id];
      html = (q.noAnswerValue && v === q.noAnswerValue)
        ? "回答しない"
        : (v && String(v).trim() ? escapeHTML(v).replace(/\n/g, "<br>") : "未回答");
    } else {
      html = data[q.id] ? escapeHTML(radioOptionLabel(q, data[q.id])) : "未回答";
      const detail = q.detailId && data[q.detailId] && String(data[q.detailId]).trim()
        ? `<br>${escapeHTML(data[q.detailId]).replace(/\n/g, "<br>")}`
        : "";
      html += detail;
    }
    return `
      <div class="view-item">
        <p class="view-question">${escapeHTML(q.label)}</p>
        <p class="view-answer">${html}</p>
      </div>`;
  }).join("");
}

/* ----- 自分のプレビュー（編集中の内容をそのまま表示。この画面では編集できない） ----- */
function renderOwnPreview() {
  document.getElementById("previewContent").innerHTML = buildQARowsHTML(collectFormData());
}

/* ----- お相手のプレビュー（常に閲覧専用。未送信なら案内のみ） ----- */
async function renderPartnerPreview() {
  const container = document.getElementById("previewContent");
  const name = AppState.partnerDisplayName || "お相手";

  if (!AppState.partnerCipherText) {
    container.innerHTML = `
      <div class="preview-empty">
        ${escapeHTML(name)}さんはまだ回答を送信していません。<br>
        送信されると、ここに表示されます。
      </div>
      <button type="button" class="partner-refresh-btn" id="partnerRefreshBtn">最新の状況を取得する</button>
    `;
  } else {
    let data;
    try {
      data = await decryptJSON(AppState.partnerCipherText, AppState.aesKey);
    } catch (e) {
      console.error("decrypt partner data failed", e);
      container.innerHTML = `<div class="preview-empty">お相手のデータの復号に失敗しました。時間をおいてもう一度お試しください。</div>`;
      return;
    }
    const dateLabel = formatDateLabel(AppState.partnerUpdatedAt);
    container.innerHTML = `
      <div class="view-header">
        <p class="view-label">回答内容（閲覧専用）</p>
        <p class="view-name">${escapeHTML(name)} さんの回答</p>
        ${dateLabel ? `<p class="view-name" style="font-size:12px;font-weight:400;color:#888;margin-top:6px;">送信日：${escapeHTML(dateLabel)}</p>` : ""}
      </div>
      ${buildQARowsHTML(data)}
      <button type="button" class="partner-refresh-btn" id="partnerRefreshBtn">最新の状況を取得する</button>
    `;
  }

  const refreshBtn = document.getElementById("partnerRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "取得中…";
      const ok = await refetchPair();
      if (ok && currentPreviewPerson === "partner") await renderPartnerPreview();
      refreshBtn.disabled = false;
      refreshBtn.textContent = "最新の状況を取得する";
    });
  }
}

/* ============================================================
   プレビュー：自分／お相手 切り替え
   ============================================================ */
let currentPreviewPerson = "own";

async function switchPreviewPerson(person) {
  currentPreviewPerson = person;
  document.querySelectorAll(".preview-person-switcher .sub-switch-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.person === person);
  });

  const ownSubmittedAtEl = document.getElementById("ownSubmittedAt");
  const sendBtn = document.getElementById("sendBtn");

  if (person === "own") {
    hideScreenshotWatermark();
    if (sendBtn) sendBtn.classList.remove("hidden");
    renderOwnPreview();
    if (ownSubmittedAtEl) {
      const name = AppState.partnerDisplayName || "お相手";
      ownSubmittedAtEl.textContent = AppState.ownSubmittedAt
        ? `${name}さんへの送信日時：${formatDateLabel(AppState.ownSubmittedAt)}`
        : `まだ${name}さんに送信していません。「送信する」を押すと届きます。`;
      ownSubmittedAtEl.classList.remove("hidden");
    }
  } else {
    if (sendBtn) sendBtn.classList.add("hidden");
    if (ownSubmittedAtEl) ownSubmittedAtEl.classList.add("hidden");
    await renderPartnerPreview();
    showScreenshotWatermark(AppState.ownerHash);
  }
}

/* ============================================================
   タブ切替
   ============================================================ */
function switchTab(tab) {
  ["input", "preview", "settings"].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== tab);
  });
  document.querySelectorAll(".bottom-nav .nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  const titles = { preview: "プレビュー", settings: "設定" };
  document.getElementById("appBarTitle").textContent = titles[tab] || "婚約前の確認";

  if (tab === "preview") {
    switchPreviewPerson(currentPreviewPerson);
  } else {
    hideScreenshotWatermark();
  }
  window.scrollTo({ top: 0 });
}

/* ============================================================
   イベント登録
   ============================================================ */
function bindEvents() {
  let saveTimer = null;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 500); };
  document.getElementById("tab-input").addEventListener("input", scheduleSave);
  document.getElementById("tab-input").addEventListener("change", scheduleSave);

  document.querySelectorAll(".bottom-nav .nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".preview-person-switcher .sub-switch-btn").forEach(btn => {
    btn.addEventListener("click", () => switchPreviewPerson(btn.dataset.person));
  });

  /* ----- 送信ボタン：お相手へ直接送信（ペア登録済みのお相手にのみ届く） ----- */
  document.getElementById("sendBtn").addEventListener("click", async () => {
    const name = AppState.partnerDisplayName || "お相手";
    if (!confirm(`入力内容を${name}さんに送信しますか？\n送信すると、これまでの内容が上書きされます。`)) return;

    const sendBtn = document.getElementById("sendBtn");
    sendBtn.disabled = true;
    const originalLabel = sendBtn.textContent;
    sendBtn.textContent = "送信中…";

    try {
      await submitOwnData();
      alert("送信しました。");
      if (currentPreviewPerson === "own") switchPreviewPerson("own");
    } catch (e) {
      console.error("submit error", e);
      alert("送信に失敗しました。通信環境を確認してもう一度お試しください。");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalLabel;
    }
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("入力内容を削除して最初から作成しますか？この操作は取り消せません。\n（すでにお相手に送信済みの内容は、この操作では削除されません）")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    location.reload();
  });
}

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

  if (!liff.isLoggedIn()) { liff.login(); return; }

  /* 友だち確認は通信を伴うため、画面構築をブロックしないよう裏で実行 */
  checkFriendship();

  /* パートナー登録の確認（未登録・交際終了なら案内を表示して終了） */
  const paired = await initPairing();
  if (!paired) return;

  setupDetailToggles();
  setupNoAnswerToggles();
  loadDraft();
  syncAllDetailToggles();
  syncAllNoAnswerToggles();
  bindEvents();
  switchTab("input");
})();
