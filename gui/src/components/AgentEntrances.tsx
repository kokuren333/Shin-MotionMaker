// CLI / MCP section (GU-06) and request.json export (GU-04).
import { useState } from "react";
import type { JobAssets, MotionForm } from "../../../src/core/index.ts";
import { docLinks, generateCommand, mcpRegistration, shells } from "../lib/commands";
import { duplicateNames, requestFilename, requestFor, requestText } from "../lib/request-io";
import { PixelIcon } from "./PixelIcon";

export function download(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function AgentEntrances({ form, assets }: { form: MotionForm; assets: JobAssets }) {
  const [status, setStatus] = useState("");
  const request = requestFor(form, assets);
  const filename = requestFilename(form);
  const attached = [...(request.assets?.sources ?? []),
    ...(["character", "secondCharacter", "bgm", "music"] as const)
      .map((key) => request.assets?.[key]).filter((name): name is string => typeof name === "string")];
  const duplicates = duplicateNames(request);
  const commands = shells.map((shell) => ({ ...shell, command: generateCommand(filename, shell.id) }));

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label}をコピーしました`);
    } catch {
      setStatus(`${label}をコピーできませんでした。表示中の文字列を選択してコピーしてください。`);
    }
  }

  return (
    <section className="agent-entrances" aria-labelledby="entrances-heading">
      <h3 id="entrances-heading"><PixelIcon name="cli" />CLI・MCP から生成する</h3>
      <p>
        いまの入力を <code>request.json</code> に書き出すと、CLI の <code>generate</code> と MCP の <code>job_generate</code> が
        この画面と同じジョブ（同じファイル・同じバイト）を作ります。添付ファイルはファイル名だけを書き出します。
      </p>
      <button
        type="button" className="ghost-button"
        onClick={() => { download(filename, requestText(request), "application/json"); setStatus(`${filename} を書き出しました`); }}
      >
        <PixelIcon name="job-zip" />
        request.json を書き出す
      </button>
      <small className="entrance-note">
        書き出し名：<code>{filename}</code>。
        {attached.length
          ? <>同じフォルダに添付ファイル {attached.length} 件（{attached.join("、")}）を置いてから実行します。</>
          : <>添付ファイルはありません。</>}
        {duplicates.length > 0 && <> 同じ名前の添付（{duplicates.join("、")}）は1つのフォルダに並べられないため、名前を変えて選び直してください。</>}
      </small>
      <h4><PixelIcon name="cli" />CLI のコマンド例</h4>
      {commands.map(({ id, label, command }) => (
        <div className="command-example" key={id} data-shell={id}>
          <strong className="command-shell">{label}</strong>
          <pre className="command-box" aria-label={`generate のコマンド例（${label}）`}>{command}</pre>
          <div className="command-actions">
            <button type="button" className="small-button" onClick={() => void copy(command, `${label}のコマンド`)}>
              <PixelIcon name="cli" />コマンドをコピー<span className="sr-only">（{label}）</span>
            </button>
          </div>
        </div>
      ))}
      <small className="entrance-note">
        シェルごとに引用符の規則が違うため、使うシェルの例を選んでください。タイトルの記号は引用符の中でそのまま1つの引数として渡ります。
        <code>jobs/</code> の下にジョブのフォルダを作ります。ZIP にするときは末尾に <code>--zip</code> を付けます。
        標準出力は JSON の封筒1個で、ゲートの不合格と道具の失敗を <code>ok</code> と <code>verdict</code> で分けて返します。
      </small>
      <h4><PixelIcon name="mcp" />MCP の登録例（stdio）</h4>
      <pre className="command-box" aria-label="MCP の登録例">{mcpRegistration()}</pre>
      <div className="command-actions">
        <button type="button" className="small-button" onClick={() => void copy(mcpRegistration(), "登録例")}>
          <PixelIcon name="mcp" />登録例をコピー
        </button>
      </div>
      <small className="entrance-note">
        <code>--root</code> の外のファイルには触れません。登録の書き方はクライアントごとに異なります。
        制作エージェントは <code>job_generate</code> の後、ジョブのファイルを直接編集して制作します。
      </small>
      <h4><PixelIcon name="link" />文書</h4>
      <ul className="doc-links">
        {docLinks.map((link) => (
          <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer">{link.label}<span className="sr-only">（新しいタブ）</span> ↗</a></li>
        ))}
      </ul>
      <small className="copy-status" role="status">{status}</small>
    </section>
  );
}
