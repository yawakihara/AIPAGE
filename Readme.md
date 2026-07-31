# ASTRA RAIDERS

ブラウザで遊べる横スクロールシューティングです。`index.html` をそのまま静的ホスティングへ置けば公開できます。

## 内容

- AI生成素材のプレイヤー機、敵機、ラスボスを使用
- 全 100 ステージのキャンペーン構成
- 100 種のラスボス名、挙動、外装シルエットを段階的に強化
- 自動生成したシンセBGMと効果音を使用
- パワーアップ 4 種
- `1` スピードアップ
- `2` 子機の追加
- `3` レーザ
- `4` シールド
- PC とタッチ操作の両対応

## ローカル確認

このフォルダをそのまま静的サーバーで配信してください。

例:

```powershell
cd C:\work\AIPAGE
python -m http.server 8080
```

その後、`http://localhost:8080` を開きます。

## 音源の再生成

効果音と BGM は次のコマンドで再生成できます。

```powershell
cd C:\work\AIPAGE
python tools\generate_audio.py
```

## 外部公開

以下の静的ホスティングでそのまま公開できます。

1. GitHub Pages
2. Netlify
3. Cloudflare Pages
4. Vercel

必要ファイルは `index.html` `style.css` `script.js` `assets/` のみです。

## オンラインランキング設定

GitHub Pages は静的サイトのため、ランキング保存には Supabase を使用します。

1. Supabase で新しいプロジェクトを作成します。
2. Supabase の `SQL Editor` を開きます。
3. `supabase-schema.sql` の内容を貼り付けて実行します。
4. Supabase の `Project Settings` から Project URL と anon public key を確認します。
5. `config.js` を次のように設定します。

```javascript
window.ASTRA_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

`service_role` キーは絶対に `config.js` へ入れないでください。ブラウザへ置いてよいのは anon public key だけです。

ランキング仕様:

- 名前は前後の空白を除去し、小文字化した値を識別キーとして扱います。
- `awakihara`、`AWAKIHARA`、`Awakihara` は同一人物として1件だけ保存されます。
- 初回登録時の表示名と4桁PINを保持します。
- PINは bcrypt ハッシュとしてデータベースへ保存されます。
- 既存名はPINが一致し、以前の最高得点を超えた場合だけ更新されます。
- PINハッシュはランキング取得APIから返されません。
