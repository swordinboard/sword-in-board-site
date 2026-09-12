interface Props {
  onAdd: () => void;
  gridOn: boolean;
  onToggleGrid: () => void;
  onRename: () => void;
  onStyle: () => void;
}

interface ToolProps {
  glyph: string;
  label: string;
  on?: boolean;
  onClick: () => void;
}

function Tool({ glyph, label, on, onClick }: ToolProps) {
  return (
    <button type="button" className={on ? 'on' : ''} onClick={onClick} aria-label={label}>
      <span className="glyph" aria-hidden>
        {glyph}
      </span>
      <span className="tool-label">{label}</span>
    </button>
  );
}

/**
 * What an editor reaches for, along the bottom while editing is on.
 *
 * These four were all buried in the menu, which meant opening a panel over
 * the board to do anything to the board. The bar mirrors the zoom controls
 * at the top and goes away the moment editing does.
 */
export default function EditorBar({ onAdd, gridOn, onToggleGrid, onRename, onStyle }: Props) {
  return (
    <div className="editor-bar" role="toolbar" aria-label="Editing tools">
      <Tool glyph="+" label="Pin up" onClick={onAdd} />
      <Tool glyph="#" label="Grid" on={gridOn} onClick={onToggleGrid} />
      <Tool glyph="✎" label="Name" onClick={onRename} />
      <Tool glyph="◑" label="Style" onClick={onStyle} />
    </div>
  );
}
