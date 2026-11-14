// Inspection results opened from files (GU-05, GU-02 "ゴースト検査結果の読み込みと静止画表示").
// Gates and advisories are rendered in separate blocks. Advisories use the neutral
// advisory style only: no error/warn colour and no fail icon (PH-03).
import { useEffect, useRef, useState } from "react";
import { classifyReport, mergeReports, verdictLabel, type ReportView } from "../lib/inspection";
import { PixelIcon } from "./PixelIcon";

export function InspectionViewer() {
  const [reports, setReports] = useState<ReportView[]>([]);
  const [stills, setStills] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const stillsRef = useRef(stills);
  stillsRef.current = stills;
  useEffect(() => () => { for (const url of Object.values(stillsRef.current)) URL.revokeObjectURL(url); }, []);

  async function open(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const images = files.filter((file) => /\.png$/i.test(file.name));
    if (images.length)
      setStills((previous) => {
        const next = { ...previous };
        for (const file of images) {
          if (next[file.name]) URL.revokeObjectURL(next[file.name]);
          next[file.name] = URL.createObjectURL(file);
        }
        return next;
      });
    const added: ReportView[] = [];
    const issues: string[] = [];
    for (const file of files.filter((entry) => /\.json$/i.test(entry.name))) {
      const result = classifyReport(file.name, await file.text());
      if (result.ok) added.push(result.view);
      else issues.push(result.message);
    }
    const others = files.filter((file) => !/\.(json|png)$/i.test(file.name));
    for (const file of others) issues.push(`${file.name}：JSON と PNG 以外は読み込みません。`);
    if (!added.length && !images.length && !issues.length)
      issues.push("検査結果の JSON（reports/*.json、.smm/runs/*/run.json）か静止画 PNG を選んでください。");
    setProblems(issues);
    if (added.length) setReports((previous) => mergeReports(previous, added));
  }

  return (
    <section className="inspection-viewer" aria-labelledby="inspection-heading">
      <h3 id="inspection-heading"><PixelIcon name="gate" />検査結果を見る</h3>
      <p>
        ジョブで実行した検査の JSON（<code>reports/validate.json</code>・<code>qc-pre.json</code>・<code>qc-post.json</code>・
        <code>ghost-check-preview.json</code>・<code>ghost-check.json</code>）、run の記録（<code>.smm/runs/&lt;id&gt;/run.json</code>）、
        ゴースト検査の静止画（<code>reports/ghost-stills/*.png</code>）を開くと、この画面に表示します。ファイルは送信しません。
        この画面は検査を実行せず、判定もし直しません。
      </p>
      <div
        className={`dropzone compact ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void open(event.dataTransfer.files); }}
      >
        <span>ここにドロップ、または</span>
        <label className="file-button">
          <PixelIcon name="folder" />
          検査結果を開く
          <input
            type="file" accept=".json,.png" multiple aria-label="検査結果のJSONと静止画を選択"
            onChange={(event) => { void open(event.target.files); event.target.value = ""; }}
          />
        </label>
      </div>
      {problems.length > 0 && (
        <div className="inline-error" role="alert">
          <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      )}
      {reports.map((report) => <ReportCard key={report.key} report={report} stills={stills} />)}
      {reports.length > 0 && (
        <button type="button" className="small-button" onClick={() => { setReports([]); setProblems([]); }}>
          <PixelIcon name="remove" />表示を消す
        </button>
      )}
    </section>
  );
}

function ReportCard({ report, stills }: { report: ReportView; stills: Record<string, string> }) {
  const gate = report.gate;
  return (
    <article className="report-card" data-report={report.key} aria-label={report.title}>
      <h4>
        <PixelIcon name={report.key.startsWith("ghost") ? "ghost-check" : "gate"} />
        {report.title}
        <small>{report.file}</small>
      </h4>
      {report.run && (
        <p className={`run-status ${report.run.abnormal ? "abnormal" : ""}`} data-run-status={report.run.status}>
          <PixelIcon name={report.run.abnormal ? "error" : "info"} />
          実行の状態：{report.run.statusLabel}
          {report.run.error && <span>（{report.run.error.code}：{report.run.error.message} {report.run.error.hint}）</span>}
        </p>
      )}
      {gate && (
        <section className="gate-block" aria-label={`${report.title}のゲート（合否）`}>
          <h5>ゲート（合否）</h5>
          <p className={`gate-verdict ${gate.verdict}`} data-verdict={gate.verdict}>
            <PixelIcon name={gate.verdict === "pass" ? "validate-ok" : gate.verdict === "fail" ? "error" : "info"} />
            判定：{verdictLabel(gate.verdict)}
          </p>
          {gate.reviewMode && (
            <p className={`review-mode ${gate.reviewMode === "self" ? "self" : ""}`} data-review-mode={gate.reviewMode}>
              review_mode: <code>{gate.reviewMode}</code>
              {gate.reviewMode === "self"
                ? "（自己レビュー。制作したエージェント自身が確認した記録で、独立したレビューではありません）"
                : "（独立レビュー）"}
            </p>
          )}
          {gate.waivers.length > 0 ? (
            <div className="waivers" aria-label="免除">
              <strong><PixelIcon name="human" />免除（オーナーだけが出せる。記録された理由）</strong>
              <ul>{gate.waivers.map((waiver) => <li key={waiver.gateId}><code>{waiver.gateId}</code> {waiver.reason}</li>)}</ul>
            </div>
          ) : gate.reviewMode ? <p className="waivers none">免除：なし</p> : null}
          {gate.rows.length > 0 && (
            <table className="gate-table">
              <thead><tr><th scope="col">項目</th><th scope="col">結果</th><th scope="col">内容</th></tr></thead>
              <tbody>
                {gate.rows.map((row) => (
                  <tr key={row.id} className={`status-${row.status}`}>
                    <th scope="row">{row.id === row.title ? row.id : <>{row.id}<br /><small>{row.title}</small></>}</th>
                    <td>{row.statusLabel}</td>
                    <td>{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      <section className="advice-block" aria-label={`${report.title}の助言`}>
        <h5><PixelIcon name="advisory" />助言（合否・終了コードに影響しません）</h5>
        {report.advisories.length ? (
          <ul>
            {report.advisories.map((advice, index) => (
              <li key={`${advice.id}-${index}`}><code>{advice.id}</code> {advice.message}</li>
            ))}
          </ul>
        ) : <p>助言はありません。</p>}
      </section>
      {report.facts.length > 0 && (
        <dl className="report-facts">
          {report.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      {report.ghost && report.ghost.worst.length > 0 && (
        <>
          <strong className="minor-heading">ワーストフレーム</strong>
          <ul className="ghost-worst">
            {report.ghost.worst.map((event) => (
              <li key={event.frame}>frame {event.frame}（{event.time}）: {event.tiles} タイル</li>
            ))}
          </ul>
        </>
      )}
      {report.ghost && report.ghost.stills.length > 0 && (
        <div className="ghost-stills">
          <strong className="minor-heading"><PixelIcon name="eye" />静止画（正解の画と照合する）</strong>
          {report.ghost.stills.map((still) => (
            <figure key={still.frame}>
              <figcaption>frame {still.frame}（{still.time}）{still.kind === "isolated" ? " 孤立" : " クラスタ代表"}</figcaption>
              <div className="ghost-still-images">
                {still.files.map((file) => {
                  const name = file.split("/").pop() ?? file;
                  return stills[name]
                    ? <img key={file} src={stills[name]} alt={`${name}（frame ${still.frame}）`} />
                    : <span key={file} className="ghost-still-missing">{name}（未選択）</span>;
                })}
              </div>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
