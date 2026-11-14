// Information dialog (GU-02 情報ダイアログ, GU-13 表示名, GU-14 版とコミット).
import { useEffect, useRef } from "react";
import { PACKAGE_VERSION, TEMPLATE_VERSION } from "../../../src/core/index.ts";
import { docLinks } from "../lib/commands";
import { PixelIcon } from "./PixelIcon";

export const buildStamp = {
  version: PACKAGE_VERSION,
  template_version: TEMPLATE_VERSION,
  commit: __SMM_BUILD__.commit,
  built_at: __SMM_BUILD__.built_at,
};

export function InfoDialog({ open, onClose, motionKitCount, highContrast, setHighContrast }: {
  open: boolean; onClose: () => void; motionKitCount: number;
  highContrast: boolean; setHighContrast: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) { if (!ref.current?.open) ref.current?.showModal(); }
    else ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby="info-heading">
      <div className="dialog-heading">
        <h2 id="info-heading">Shin-MotionMaker について</h2>
        <button className="small-button" type="button" onClick={onClose}>閉じる</button>
      </div>
      <p>
        Shin-MotionMaker は、動画の企画・資料・演出方針を、制作エージェントへ渡すジョブのZIPにまとめます。AI API、バックエンド、アカウントは必要ありません。
        同じ入力から、この画面・CLI・MCP のどれでも同じジョブを作れます。
      </p>
      <dl className="version-facts" aria-label="版">
        <div><dt>版</dt><dd><code>{buildStamp.version}</code></dd></div>
        <div><dt>テンプレート</dt><dd><code>{buildStamp.template_version}</code></dd></div>
        <div><dt>コミット</dt><dd><code data-commit>{buildStamp.commit}</code></dd></div>
        <div><dt>ビルド日時</dt><dd><code>{buildStamp.built_at ?? "開発サーバー"}</code></dd></div>
      </dl>
      <h3>同梱するもの</h3>
      <p>
        制作指示、JSON設定、ブリーフ、添付資料、最小Remotion / React / Three.jsプロジェクト、Aivisラッパー、字幕・BGMの再生口、Codex imagegenラッパー、
        {motionKitCount}個のmotion-kitコンポーネント、preview / build / validate / qc / ghost-check のコマンド。依存パッケージやNode.js、Aivisエンジン、3Dモデルは自動で同梱しません。
      </p>
      <h3>データの扱い</h3>
      <p>
        入力やファイルはサーバーへ送信せず、ブラウザのメモリ内でZIP化します。再読み込みすると入力は消えます（残すときは request.json に書き出します）。
        参考URLはこの画面では取得しません。検査結果のファイルも、開いたブラウザの中だけで表示します。ZIPを渡したエージェントや、その制作環境でのデータ処理は各サービスの設定に従います。
      </p>
      <h3>制作環境と参考元</h3>
      <p>
        ZIPの実行にはNode.js 22以上、依存パッケージの取得、Remotionのレンダリング用ブラウザが必要です。音声合成には別途AivisSpeechを起動します。Remotionの利用条件は同梱READMEの公式リンクで確認できます。
      </p>
      <p>
        <a href="https://github.com/kokuren333/BiimMotionWebUI" target="_blank" rel="noreferrer">BiimMotion<span className="sr-only">（新しいタブ）</span> ↗</a>
        （コミット 262c798）の生成コア・制作ハーネス・画面を引き継いでいます。BiimMotion は
        <a href="https://github.com/kokuren333/BookOrderWebUI" target="_blank" rel="noreferrer">BookOrderWebUI<span className="sr-only">（新しいタブ）</span> ↗</a>
        のジョブ生成構成と、
        <a href="https://github.com/kokuren333/BiimSlideMaker" target="_blank" rel="noreferrer">BiimSlideMaker<span className="sr-only">（新しいタブ）</span> ↗</a>
        の音声合成・動画制作方針を参考にしています。画面のテーマとアイコンは CyberSprite のファミリーテーマ「Circuit White / Solder Mask」です。
      </p>
      <h3><PixelIcon name="link" />文書</h3>
      <ul className="doc-links">
        {docLinks.map((link) => (
          <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}<span className="sr-only">（新しいタブ）</span> ↗</a></li>
        ))}
      </ul>
      <h3><PixelIcon name="settings" />表示</h3>
      <label className="check-label">
        <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
        <span>
          高コントラスト表示
          <small>線と文字をすべて濃い色にします。OS のコントラスト設定（prefers-contrast: more）が有効なら最初からオンです。</small>
        </span>
      </label>
    </dialog>
  );
}
