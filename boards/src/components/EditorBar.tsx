import type { StringColor } from '../../shared/types';
import { STRING_COLORS } from '../../shared/types';
interface Props {
  onAdd: () => void;
  gridOn: boolean;
  onToggleGrid: () => void;
  onRename: () => void;
  onStyle: () => void;
  /** Tying strings between items. While it is on, a tap picks an end. */
  stringing: boolean;
  onToggleStringing: () => void;
  stringColor: StringColor;
  onStringColor: (color: StringColor) => void;
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
export default function EditorBar({
  onAdd,
  gridOn,
  onToggleGrid,
  onRename,
  onStyle,
  stringing,
  onToggleStringing,
  stringColor,
  onStringColor,
}: Props) {
  return (
    <div className="editor-bar" role="toolbar" aria-label="Editing tools">
      {/* The colours only appear while there is something to colour. */}
      {stringing ? (
        <div className="string-colors" role="group" aria-label="String colour">
          {STRING_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch string-${color}${color === stringColor ? ' on' : ''}`}
              aria-label={color}
              aria-pressed={color === stringColor}
              onClick={() => onStringColor(color)}
            />
          ))}
        </div>
      ) : null}
      {/*
        The editing flag, which used to float at the top of the screen on its
        own and sat underneath the zoom controls on a phone. It belongs to the
        bar: the bar is only ever there while editing is on, so the label and
        the tools say the same thing in one place.
      */}
      <div className="mode-flag">Editing</div>
      <Tool glyph="+" label="Pin up" onClick={onAdd} />
      <Tool glyph="#" label="Grid" on={gridOn} onClick={onToggleGrid} />
      <Tool glyph="⁄" label="String" on={stringing} onClick={onToggleStringing} />
      <Tool glyph="✎" label="Name" onClick={onRename} />
      <Tool glyph="◑" label="Style" onClick={onStyle} />
    </div>
  );
}
