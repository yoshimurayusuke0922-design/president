# Daifugo Codex Spec Bundle

Codex にそのまま渡しやすいよう、仕様を処理別のフォルダに分けています。

## フォルダ構成

- `00_overview/` : 目的、要件、実装計画、受け入れ条件
- `01_rules/` : ゲームルール
- `02_product/` : 画面仕様、機能仕様、UI仕様
- `03_architecture/` : 技術設計、フォルダ設計
- `04_ai/` : CPU仕様
- `05_prompts/` : Codex に投げる依頼文
- `skills/` : 後から必要になった reusable な skill / setup / helper を置く場所

## 使い方のおすすめ

1. まず `AGENTS.md` を root に置いて Codex に読ませる
2. 次に `05_prompts/codex_prompt_phase1.md` を最初の依頼として渡す
3. Phase 1 が終わったら `05_prompts/codex_prompt_full.md` を元に差分実装させる
4. 追加ローカルルールは、状態遷移が安定してから入れる

## 注意

この仕様は「まず壊れずに遊べる」ことを優先しています。
UI を先に盛るより、サーバ権威の状態遷移とルール判定を先に固める前提です。
