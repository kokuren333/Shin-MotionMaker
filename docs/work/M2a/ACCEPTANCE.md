<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M2a 受け入れ判定（L2）

- 判定：**合格（条件付き：ubuntu の実行証拠は持ち越し）**（2026-11-14 18:43、main 0787aea に --no-ff マージ）

| 受け入れ条件（§11.2 M2a） | 証拠（L2 実測） |
| --- | --- |
| TS-07 が ubuntu と windows で合格 | windows：m2a で 177 件（166 pass／2 skip（OS 専用、理由付き）／9 todo（M2b）／0 fail）、マージ後 ci-local 同数 RC=0。**ubuntu：未実施**（WSL・リモートなし。Q-01 によりリモート作成後の CI で確認。M8 の前提条件に積む） |
| パスのテスト（CL-11、MC-02） | テスト合格。M2aR の probe を L2 が再実行：UNC・デバイスパスは即 E_PATH_DENIED（修正前は SMB 接続 21 秒・E_INTERNAL）、ハードリンクの report_get は E_PATH_DENIED、存在しない allow-dir は起動時に E_PATH_DENIED |
| AR-06 | M1 移送分（独立テンプレート読み込み比較）を M2a で埋めた。GUI 経路との最終一致は M7 |
| 交差レビュー | M2aR（Opus 高）条件付き承認 → M2a-fix で M-1・M-2・R-1〜R-7・P-1〜P-9 対応。PID 再利用 probe：無関係プロセスは生存（修正前は taskkill で停止）。同一性記録の無い run 記録は停止せず保留（保守的な設計として受容） |

残課題：ubuntu（Node 24/22）での TS-07・MC-02・CL-11・R-6（detached 孫の停止）。プロセス同一性の照合とシグナル送信の間の競合リスク（REPORT §147）は docs/MCP.md に記載させる（M3）。
