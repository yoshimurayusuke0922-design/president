# Vercel + Render deploy

## 目的

- frontend を Vercel に公開する
- backend を Render Web Service に公開する
- `socket.io` は Render 側に集約する

## 前提

- Vercel にログイン済み
- Render にログイン済み
- このコードを GitHub / GitLab / Bitbucket のリポジトリへ push 済み

## Render backend

1. Render Dashboard で `New > Blueprint`
2. push 済みリポジトリを接続
3. repo root の `render.yaml` をそのまま使う
4. デプロイ完了後、`https://<service>.onrender.com/health` が `{"ok":true}` を返すことを確認

補足:
- Render Free は 15 分アイドルで sleep する
- active なゲーム中は動き続ける
- backend だけを Render に置く。frontend は Vercel に出す

## Vercel frontend

Render の backend URL が決まったら、次を実行する:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\setup\deploy-vercel-frontend.ps1 -BackendUrl "https://<service>.onrender.com"
```

このスクリプトは `VITE_SERVER_URL` を build 時に注入して `frontend` を production deploy する。

## 動作確認

1. Vercel URL を開く
2. ルーム作成
3. 別端末で参加
4. プレイ開始後にカード出し、パス、再接続を確認
