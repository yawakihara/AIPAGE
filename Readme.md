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
