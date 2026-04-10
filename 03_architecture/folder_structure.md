# Folder Structure Policy

## 方針

ファイル整理は「処理別」で分ける。  
画面、ロジック、通信、補助資産を混ぜない。

## ルール

- 画面は画面
- UI部品は UI部品
- サーバロジックはサーバロジック
- ルール判定は rule
- AI は ai
- socket は socket
- 再利用資産は skills

## 望ましい構成

```text
project-root/
  AGENTS.md
  README.md

  frontend/
    src/
      screens/        # 画面単位
      components/     # 再利用 UI
      hooks/          # frontend 側 hook
      services/       # API / socket client
      store/          # 状態管理
      types/          # frontend 用型

  backend/
    src/
      game/
        core/         # ゲーム進行
        rules/        # 役判定・比較
        ai/           # CPU 思考
        types/        # 共通型
        utils/        # 補助関数
      rooms/          # ルーム管理
      sockets/        # socket ハンドラ
      services/       # backend サービス
      tests/          # テスト

  00_overview/
  01_rules/
  02_product/
  03_architecture/
  04_ai/
  05_prompts/

  skills/
    setup/
    debug/
    codegen/
    prompts/
```

## 避けること

- root に雑多なファイルを増やす
- socket ロジックとルール判定を同じ場所に置く
- 画面コンポーネントにゲーム判定をベタ書きする
- 補助スクリプトを本体コードに混ぜる

## skills フォルダの扱い

必要な skill や reusable な補助資産が出たら、都度 `skills/` を作ってその中に整理する。  
依存導入手順、補助スクリプト、デバッグ手順、コード生成テンプレートは `skills/` に寄せる。
