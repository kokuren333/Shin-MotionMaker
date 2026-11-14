// 16x16 pixel icons from gui/public/icons/ (M5, manifest.json). Always placed next to a
// text label (GU-10); never on an ink surface (wrap with className="ico-chip" there).
export type IconName =
  | "add" | "advisory" | "agent" | "app" | "cli" | "error" | "eye" | "folder" | "gate"
  | "ghost-check" | "human" | "info" | "job-zip" | "link" | "mcp" | "mode-explainer" | "mode-mv"
  | "remove" | "settings" | "sources" | "style-anime" | "style-biim" | "style-mixed"
  | "style-motion" | "validate-ok" | "warning";

export function PixelIcon({ name, chip = false }: { name: IconName; chip?: boolean }) {
  const image = (
    <img className="ico" src={`${import.meta.env.BASE_URL}icons/${name}.png`} width={16} height={16} alt="" />
  );
  return chip ? <span className="ico-chip">{image}</span> : image;
}

/** Family theme notch: a 45° pixel cut on the top-left corner of a region. */
export function Notch() {
  return (
    <svg className="notch" width={11} height={11} aria-hidden="true">
      <path className="notch-out" d="M0 0h10v1h-10zM0 1h9v1h-9zM0 2h8v1h-8zM0 3h7v1h-7zM0 4h6v1h-6zM0 5h5v1h-5zM0 6h4v1h-4zM0 7h3v1h-3zM0 8h2v1h-2zM0 9h1v1h-1z" />
      <path className="notch-halo" d="M10 0h1v1h-1zM9 1h1v1h-1zM8 2h1v1h-1zM7 3h1v1h-1zM6 4h1v1h-1zM5 5h1v1h-1zM4 6h1v1h-1zM3 7h1v1h-1zM2 8h1v1h-1zM1 9h1v1h-1zM0 10h1v1h-1z" />
      <path className="notch-line" d="M10 1h1v1h-1zM9 2h2v1h-2zM8 3h2v1h-2zM7 4h2v1h-2zM6 5h2v1h-2zM5 6h2v1h-2zM4 7h2v1h-2zM3 8h2v1h-2zM2 9h2v1h-2zM1 10h2v1h-2z" />
    </svg>
  );
}

export const sizeLabel = (size: number) =>
  size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

export function AttachmentList({ files, remove }: { files: { name: string; size: number }[]; remove: (index: number) => void }) {
  return (
    <ul className="attachments">
      {files.map((file, i) => (
        <li key={`${i}-${file.name}`}>
          <div>
            <strong title={file.name}>{file.name}</strong>
            <small>{sizeLabel(file.size)}</small>
          </div>
          <button type="button" className="small-button" aria-label={`${file.name}を削除`} onClick={() => remove(i)}>
            <PixelIcon name="remove" />
            削除
          </button>
        </li>
      ))}
    </ul>
  );
}
