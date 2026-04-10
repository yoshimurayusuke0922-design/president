# AGENTS.md

## 最重要方針

- まずオンライン対戦の同期とゲーム状態遷移を安定させる
- UI を先に作り込みすぎない
- クライアントを正にしない。サーバを正にする
- 非合法手はクライアントでも抑止し、サーバでも必ず再検証する
- 追加効果のあるローカルルールは `pendingEffect` などの段階処理で扱う
- 処理別でフォルダを分ける。機能を root に散らかさない

## フォルダ運用ルール

- 画面は `frontend/src/screens`
- UI部品は `frontend/src/components`
- ゲームロジックは `backend/src/game`
- ルーム管理は `backend/src/rooms`
- socket ハンドラは `backend/src/sockets`
- 共通型は `backend/src/game/types` と `frontend/src/types`
- テストは対象処理の近くか `tests` にまとめる

## skills フォルダ運用

必要な reusable な helper、setup、作業手順、補助スクリプトが必要になったら、root に `skills/` を作り、その中に用途別で置くこと。

例:
- `skills/setup/`
- `skills/codegen/`
- `skills/debug/`
- `skills/prompts/`

ルール:
- 一時ファイルを root に散らかさない
- 再利用しそうなものだけ `skills/` に置く
- 依存導入手順や補助スクリプトも、まず `skills/` 配下に整理する
- アプリ本体コードと補助資産を混ぜない

## 実装順

1. backend のルーム作成、参加、同期
2. 基本ルールだけで 1 ゲーム最後まで進行
3. CPU Easy / Normal / Hard
4. frontend の最小 UI
5. 追加ローカルルール
6. カード交換
7. 見た目の改善

## 禁止

- 状態管理を画面コンポーネント内にベタ書きしない
- socket イベントごとに独自状態を乱立させない
- ローカルルールごとの if 文を UI に散らかさない
- 先にアニメーションへ逃げない
