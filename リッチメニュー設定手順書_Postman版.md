# タブ切り替え式リッチメニュー設定 手順書（Postman版）

コマンドプロンプト・ターミナルを使わず、Postmanという無料アプリの画面操作だけで設定する方法です。

---

## 0. Postmanをインストールする

1. [https://www.postman.com/downloads/](https://www.postman.com/downloads/) にアクセス
2. お使いのPC（Mac／Windows）用のインストーラーをダウンロードして実行
3. 起動後、アカウント作成（メールアドレスでOK、無料）を求められたら作成してログイン
4. 「Create a new Collection」などが表示されたら、わかりやすい名前（例：`リッチメニュー設定`）でコレクションを1つ作っておくと、後で作ったリクエストをまとめておけます

---

## 0.5 事前に準備するもの（前回と同じ）

| 準備するもの | 入手方法 |
|---|---|
| チャネルアクセストークン | LINE Developers Console → 対象チャネル → 「Messaging API設定」タブ → 「チャネルアクセストークン（長期）」の「発行」 |
| リッチメニュー画像2枚 | IMG_2902.png（プレ交際タブ）、IMG_2903.png（真剣交際タブ） |
| 各カードのLIFF ID | LINE Developers Console → 該当のLINEミニアプリのチャネル → 「LIFF」タブ |

---

## 1. リッチメニューAを作成する【プレ交際】

### ① 新規リクエストを作成
- 左上の「+」ボタン（New）→「HTTP Request」を選択

### ② メソッドとURLを設定
- 一番左のプルダウンを **POST** に変更
- URL欄に以下を入力

```
https://api.line.me/v2/bot/richmenu
```

### ③ Headersタブを設定
リクエスト画面上部の「Headers」タブをクリックし、以下の2行を追加します。

| Key | Value |
|---|---|
| Authorization | Bearer {channel access token} |
| Content-Type | application/json |

※ `{channel access token}` の部分はご自身のトークンに書き換えてください（`Bearer ` の後にスペース1つ空けて貼り付け）

### ④ Bodyタブを設定
「Body」タブ→「raw」を選択→右端のプルダウンを「JSON」に変更し、以下をそのまま貼り付けます。

```json
{
    "size": { "width": 2500, "height": 1686 },
    "selected": true,
    "name": "richmenu-pre",
    "chatBarText": "メニュー",
    "areas": [
        {
            "bounds": { "x": 1250, "y": 0, "width": 1250, "height": 223 },
            "action": {
                "type": "richmenuswitch",
                "richMenuAliasId": "richmenu-alias-shinken",
                "data": "switch-to-shinken"
            }
        },
        {
            "bounds": { "x": 0, "y": 223, "width": 836, "height": 998 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{自己開示Part1のliffId}" }
        },
        {
            "bounds": { "x": 836, "y": 223, "width": 827, "height": 998 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{自己開示Part2のliffId}" }
        },
        {
            "bounds": { "x": 1663, "y": 223, "width": 837, "height": 998 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{自己開示Part3のliffId}" }
        },
        {
            "bounds": { "x": 0, "y": 1221, "width": 1250, "height": 465 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{婚活プロフィールのliffId}" }
        },
        {
            "bounds": { "x": 1250, "y": 1221, "width": 1250, "height": 465 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{価値観すり合わせのliffId}" }
        }
    ]
}
```

### ⑤ 送信する
- 右上の青い「Send」ボタンをクリック
- 画面下部に結果が表示されます

```json
{
    "richMenuId": "richmenu-9e9cca5bef53a7097cf80e93def32a8a"
}
```

👉 この `richmenu-xxxxxxxxxxxxxxxxxxxx` を**メモ帳などにコピー保存**してください。これを以後 `{richMenuId_A}` とします。

---

## 2. リッチメニューAに画像をアップロードする

### ① 新規リクエストを作成
- 「+」で新しいリクエストタブを開く

### ② メソッドとURLを設定
- **POST** に変更
- URL欄に、`{richMenuId_A}` を先ほどメモしたIDに置き換えて入力

```
https://api-data.line.me/v2/bot/richmenu/{richMenuId_A}/content
```

### ③ Headersタブを設定

| Key | Value |
|---|---|
| Authorization | Bearer {channel access token} |
| Content-Type | image/png |

### ④ Bodyタブを設定
- 「Body」タブ→今度は「raw」ではなく **「binary」** を選択
- 「Select File」ボタンが表示されるのでクリックし、`IMG_2902.png`（プレ交際タブの画像）を選択

### ⑤ 送信する
- 「Send」をクリック
- 下部に何もエラーが表示されなければ成功です（レスポンスが空でもOK）

---

## 3. リッチメニューBを作成する【真剣交際】

手順1と同じ要領で、新しいリクエストを作成します。

- メソッド：**POST**
- URL：

```
https://api.line.me/v2/bot/richmenu
```

- Headers：手順1と同じ（Authorization / Content-Type）
- Body（raw / JSON）：

```json
{
    "size": { "width": 2500, "height": 1686 },
    "selected": false,
    "name": "richmenu-shinken",
    "chatBarText": "メニュー",
    "areas": [
        {
            "bounds": { "x": 0, "y": 0, "width": 1250, "height": 223 },
            "action": {
                "type": "richmenuswitch",
                "richMenuAliasId": "richmenu-alias-pre",
                "data": "switch-to-pre"
            }
        },
        {
            "bounds": { "x": 0, "y": 223, "width": 836, "height": 1463 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{真剣交際後の確認のliffId}" }
        },
        {
            "bounds": { "x": 836, "y": 223, "width": 827, "height": 1463 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{家条件すり合わせのliffId}" }
        },
        {
            "bounds": { "x": 1663, "y": 223, "width": 837, "height": 1463 },
            "action": { "type": "uri", "uri": "https://miniapp.line.me/{家族紹介のliffId}" }
        }
    ]
}
```

- 「Send」をクリックし、返ってきた `richMenuId` をメモ →これを `{richMenuId_B}` とします。

---

## 4. リッチメニューBに画像をアップロードする

手順2と同じ要領です。

- メソッド：**POST**
- URL（`{richMenuId_B}` に置き換え）：

```
https://api-data.line.me/v2/bot/richmenu/{richMenuId_B}/content
```

- Headers：手順2と同じ
- Body（binary）：`IMG_2903.png`（真剣交際タブの画像）を選択
- 「Send」

---

## 5. デフォルトメニューを設定する（最初にAを表示させる）

### ① 新規リクエストを作成
- メソッドを **POST** に変更
- URL（`{richMenuId_A}` に置き換え）：

```
https://api.line.me/v2/bot/user/all/richmenu/{richMenuId_A}
```

### ② Headersタブ

| Key | Value |
|---|---|
| Authorization | Bearer {channel access token} |

### ③ Bodyタブ
- 何も入力せず空欄のまま（「none」を選択）でOK

### ④ 「Send」をクリック

---

## 6. エイリアスを作成する（タブ切り替えの本体）

**2つのリクエストを作成し、両方とも実行**してください。

### 6-1. プレ交際側のエイリアス

- メソッド：**POST**
- URL：

```
https://api.line.me/v2/bot/richmenu/alias
```

- Headers：手順1と同じ（Authorization / Content-Type）
- Body（raw / JSON）：

```json
{
    "richMenuAliasId": "richmenu-alias-pre",
    "richMenuId": "{richMenuId_A}"
}
```

（`{richMenuId_A}` の部分は実際のIDに書き換えて送信）

### 6-2. 真剣交際側のエイリアス

同じURL・同じHeadersで、新しいリクエストとして以下を送信します。

```json
{
    "richMenuAliasId": "richmenu-alias-shinken",
    "richMenuId": "{richMenuId_B}"
}
```

（`{richMenuId_B}` の部分は実際のIDに書き換えて送信）

---

## 7. 動作確認

1. 自分のLINE公式アカウントのトーク画面を開き直す
2. リッチメニューが画像1（プレ交際タブ）の状態で表示される
3. 右上「真剣交際」をタップ → 画像2に切り替わる
4. 各カードをタップ → 該当のLINEミニアプリが開く

---

## Postmanでのよくあるつまずきポイント

| 症状 | 原因の可能性 |
|---|---|
| Sendを押すと「401 Unauthorized」 | Authorizationの値が `Bearer {トークン}` の形式になっていない（Bearerの後にスペースが必要） |
| 画像アップロードで失敗する | Bodyタブで「raw」のままになっている（画像は必ず「binary」を選択する） |
| JSONを貼ったのにエラーになる | Body右端のプルダウンが「JSON」になっていない（Textのままだと構文エラー扱いになることがある） |
| 何度もリクエストを作るのが面倒 | 一度作ったリクエストは複製（右クリック→Duplicate）して、URLやBodyの一部だけ書き換えると早いです |

---

## リクエスト一覧まとめ（Postmanで作る6つのリクエスト）

| # | 名前の例 | メソッド | 用途 |
|---|---|---|---|
| 1 | ①richmenu作成_A | POST | プレ交際メニュー作成 |
| 2 | ②richmenu画像_A | POST | プレ交際に画像をアップロード |
| 3 | ③richmenu作成_B | POST | 真剣交際メニュー作成 |
| 4 | ④richmenu画像_B | POST | 真剣交際に画像をアップロード |
| 5 | ⑤デフォルト設定 | POST | 初期表示メニューをAに設定 |
| 6 | ⑥エイリアス作成×2 | POST | pre／shinkenのエイリアスをそれぞれ作成 |

全部で作るリクエストは6〜7個（エイリアスは2回送信するので実質7回のSend）です。コレクションにまとめて保存しておけば、次回の改修時も同じ画面を開いて中身を書き換えるだけで再利用できます。
