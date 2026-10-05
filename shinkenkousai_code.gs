/* ============================================================
   婚約前の確認 – GAS バックエンド (Code.gs)
   スプレッドシートID: YOUR_SPREADSHEET_ID_HERE
   ------------------------------------------------------------
   ・Shares    シート : 共有用の暗号化済み回答（本人／初回閲覧者のみ復号可）
   ・Analytics シート : 統計集計に必要な項目のみを平文で保存
   ------------------------------------------------------------
   デプロイ方法:
   1. スプレッドシートを開き「拡張機能 > Apps Script」でこのコードを貼り付ける。
   2. 「デプロイ > 新しいデプロイ」→ 種類「ウェブアプリ」
      - 実行するユーザー: 自分
      - アクセスできるユーザー: 全員
      でデプロイする（発行された /exec URL を app.js の GAS_ENDPOINT に設定する）。
   3. Shares シートの1行目に見出し、Analytics シートの1行目に見出しを用意しておく
      （列の並びは下記 COL / ACOL の順）。
   ============================================================ */

var SPREADSHEET_ID  = 'YOUR_SPREADSHEET_ID_HERE';
var SHARES_SHEET     = 'Shares';
var ANALYTICS_SHEET  = 'Analytics';
var SCHEMA_VERSION   = 1;

// Shares シートの列番号（1-indexed）
var COL = {
  ID: 1, CIPHER_TEXT: 2, ENCRYPTED_KEY: 3, OWNER_HASH: 4, VIEWER_HASH: 5,
  STATUS: 6, SCHEMA_VERSION: 7, CREATED_AT: 8, UPDATED_AT: 9,
  FIRST_VIEWED_AT: 10, LAST_VIEWED_AT: 11, VIEW_COUNT: 12
};

// Analytics シートの列番号（1-indexed）
// 列順: id, ownerHash, viewerHash, createdAt, Q1〜Q36
// （Q11・Q12 はラジオ本体の直後に詳細自由記述欄が続く）
var ACOL = {
  ID: 1, OWNER_HASH: 2, VIEWER_HASH: 3, CREATED_AT: 4,
  Q1: 5, Q2: 6, Q3: 7, Q4: 8, Q5: 9, Q6: 10, Q7: 11, Q8: 12, Q9: 13, Q10: 14,
  Q11: 15, Q11_DETAIL: 16, Q12: 17, Q12_DETAIL: 18,
  Q13: 19, Q14: 20, Q15: 21, Q16: 22, Q17: 23, Q18: 24,
  Q19: 25, Q20: 26, Q21: 27, Q22: 28, Q23: 29, Q24: 30, Q25: 31, Q26: 32,
  Q27: 33, Q28: 34, Q29: 35, Q30: 36, Q31: 37,
  Q32: 38, Q33: 39, Q34: 40, Q35: 41, Q36: 42
};

var DATA_START_ROW = 2; // 1行目=見出し, 2行目以降がデータ

/* ------------------------------------------------------------
   真剣交際パートナー機能連携（Partners中央API／任意機能）
   未使用の場合は INTERNAL_SECRET を空のままにしておけば、
   getPartnerStatus は常に { active:false, everPartnered:false } を
   返し、従来の「初回閲覧者固定」ロジックにフォールバックする。
   ------------------------------------------------------------ */
var PARTNERS_ENDPOINT = 'YOUR_PARTNERS_GAS_EXEC_URL_HERE'; // ← 使わない場合は空文字のままでよい
var INTERNAL_SECRET    = PropertiesService.getScriptProperties().getProperty('INTERNAL_SECRET') || '';

var PARTNER_STATUS_CACHE_SECONDS = 900;

function getPartnerStatus(ownerHash) {
  var result = { active: false, everPartnered: false, partnerHash: '' };
  if (!PARTNERS_ENDPOINT || !INTERNAL_SECRET) return result;

  var cache = CacheService.getScriptCache();
  var cacheKey = 'partner_' + ownerHash;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    var url = PARTNERS_ENDPOINT + '?action=status'
      + '&ownerHash=' + encodeURIComponent(ownerHash)
      + '&secret=' + encodeURIComponent(INTERNAL_SECRET);
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var body = JSON.parse(res.getContentText());
    if (body.ok) {
      result = {
        active: !!body.active,
        everPartnered: !!body.everPartnered,
        partnerHash: body.partnerHash || ''
      };
    }
  } catch (err) {
    Logger.log('getPartnerStatus failed: ' + err);
  }
  cache.put(cacheKey, JSON.stringify(result), PARTNER_STATUS_CACHE_SECONDS);
  return result;
}

/* ------------------------------------------------------------
   エントリポイント
   ------------------------------------------------------------ */
function doGet(e) {
  try {
    var action = e.parameter.action;
    if (action === 'view') {
      return handleView(e.parameter.id, e.parameter.viewerHash);
    }
    return jsonResponse({ ok: false, reason: 'invalid_action' });
  } catch (err) {
    return jsonResponse({ ok: false, reason: 'server_error', message: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'share') {
      return handleShare(body);
    }
    return jsonResponse({ ok: false, reason: 'invalid_action' });
  } catch (err) {
    return jsonResponse({ ok: false, reason: 'server_error', message: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/* ------------------------------------------------------------
   共有登録（回答の保存）
   ・cipherText はクライアント側で AES-GCM 暗号化済みのため、
     このサーバー（および管理者）は復号鍵を一切受け取らない。
   ・Analytics: 同じ ownerHash（同一LINEアカウント）から再度共有
     された場合、以前の行を上書きする（＝1人1行に統一される）。
   ・Shares: 同じ ownerHash の既存行のうち、まだ誰にも開かれて
     いない（VIEWER_HASH が空の）行だけを上書きする。
     すでに誰かが開いた行は履歴として残し、新しい行を追加する。
   ------------------------------------------------------------ */
function handleShare(body) {
  var id         = body.id;
  var cipherText = body.cipherText;
  var ownerHash  = body.ownerHash;
  var analytics  = body.analytics || {};

  if (!id || !cipherText || !ownerHash) {
    return jsonResponse({ ok: false, reason: 'invalid_params' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var sharesSheet    = ss.getSheetByName(SHARES_SHEET);
    var analyticsSheet = ss.getSheetByName(ANALYTICS_SHEET);
    var now = new Date();

    var shareRow = [
      id, cipherText, '', ownerHash, '', 'active', SCHEMA_VERSION,
      now, now, '', '', 0
    ];
    upsertUnviewedShareRow(sharesSheet, ownerHash, shareRow);

    var a = analytics;
    var analyticsRow = [
      id, ownerHash, '', now,
      a.q1 || '', a.q2 || '', a.q3 || '', a.q4 || '', a.q5 || '',
      a.q6 || '', a.q7 || '', a.q8 || '', a.q9 || '', a.q10 || '',
      a.q11 || '', a.q11Detail || '', a.q12 || '', a.q12Detail || '',
      a.q13 || '', a.q14 || '', a.q15 || '', a.q16 || '', a.q17 || '', a.q18 || '',
      a.q19 || '', a.q20 || '', a.q21 || '', a.q22 || '', a.q23 || '', a.q24 || '',
      a.q25 || '', a.q26 || '',
      a.q27 || '', a.q28 || '', a.q29 || '', a.q30 || '', a.q31 || '',
      a.q32 || '', a.q33 || '', a.q34 || '', a.q35 || '', a.q36 || ''
    ];
    upsertAnalyticsRow(analyticsSheet, ownerHash, analyticsRow);

    return jsonResponse({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}

function upsertUnviewedShareRow(sheet, ownerHash, rowValues) {
  var lastRow = sheet.getLastRow();
  var targetRow = null;
  if (lastRow >= DATA_START_ROW) {
    var values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, COL.VIEWER_HASH).getValues();
    for (var i = 0; i < values.length; i++) {
      var rowOwnerHash  = values[i][COL.OWNER_HASH - 1];
      var rowViewerHash = values[i][COL.VIEWER_HASH - 1];
      if (rowOwnerHash === ownerHash && !rowViewerHash) {
        targetRow = DATA_START_ROW + i;
        break;
      }
    }
  }
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function upsertAnalyticsRow(sheet, ownerHash, rowValues) {
  var targetRow = findAnalyticsRowByOwnerHash(sheet, ownerHash);
  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

/* ------------------------------------------------------------
   閲覧（共有リンクを開いたとき）
   アクセス制御:
   ・本人（ownerHash と一致） → 常に許可
   ・viewerHash が未登録      → この人を初回閲覧者として登録し許可
   ・viewerHash が登録済み    → 一致すれば許可、不一致なら拒否
   ------------------------------------------------------------ */
function handleView(id, viewerHash) {
  if (!id) return jsonResponse({ ok: false, reason: 'invalid_params' });
  if (!viewerHash) return jsonResponse({ ok: false, reason: 'login_required' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSpreadsheet().getSheetByName(SHARES_SHEET);
    var rowIndex = findRowById(sheet, id);
    if (!rowIndex) return jsonResponse({ ok: false, reason: 'not_found' });

    var row = sheet.getRange(rowIndex, 1, 1, COL.VIEW_COUNT).getValues()[0];
    var cipherText         = row[COL.CIPHER_TEXT - 1];
    var ownerHash           = row[COL.OWNER_HASH - 1];
    var existingViewerHash  = row[COL.VIEWER_HASH - 1];
    var status              = row[COL.STATUS - 1];

    if (status !== 'active') {
      return jsonResponse({ ok: false, reason: status === 'active' ? 'not_found' : status });
    }

    var now = new Date();
    var allowed = false;
    var partnerInfo = getPartnerStatus(ownerHash);

    if (viewerHash === ownerHash) {
      allowed = true;
    } else if (partnerInfo.active) {
      allowed = (viewerHash === partnerInfo.partnerHash);
    } else if (partnerInfo.everPartnered) {
      allowed = false;
    } else if (!existingViewerHash) {
      allowed = true;
      sheet.getRange(rowIndex, COL.VIEWER_HASH).setValue(viewerHash);
      sheet.getRange(rowIndex, COL.FIRST_VIEWED_AT).setValue(now);
      updateAnalyticsViewerHash(id, viewerHash);
    } else if (existingViewerHash === viewerHash) {
      allowed = true;
    } else {
      allowed = false;
    }

    if (!allowed) {
      return jsonResponse({ ok: false, reason: (partnerInfo.active || partnerInfo.everPartnered) ? 'partner_locked' : 'forbidden' });
    }

    sheet.getRange(rowIndex, COL.LAST_VIEWED_AT).setValue(now);
    var viewCountCell = sheet.getRange(rowIndex, COL.VIEW_COUNT);
    viewCountCell.setValue((Number(viewCountCell.getValue()) || 0) + 1);

    return jsonResponse({ ok: true, cipherText: cipherText });
  } finally {
    lock.releaseLock();
  }
}

function updateAnalyticsViewerHash(id, viewerHash) {
  var sheet = getSpreadsheet().getSheetByName(ANALYTICS_SHEET);
  var rowIndex = findRowById(sheet, id);
  if (rowIndex) sheet.getRange(rowIndex, ACOL.VIEWER_HASH).setValue(viewerHash);
}

/* Analyticsシート上で ownerHash が一致する行を探す（見つからなければ null） */
function findAnalyticsRowByOwnerHash(sheet, ownerHash) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return null;
  var values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, ACOL.OWNER_HASH).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][ACOL.OWNER_HASH - 1] === ownerHash) return DATA_START_ROW + i;
  }
  return null;
}

/* id (A列) からデータ行番号を探す。見つからなければ null */
function findRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return null;
  var ids = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return DATA_START_ROW + i;
  }
  return null;
}
