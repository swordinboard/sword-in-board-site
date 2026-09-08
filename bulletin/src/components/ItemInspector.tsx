import type { BoardItem, FrameStyle, HangerStyle } from '../../shared/types';
import { PIN_COLORS } from '../../shared/types';
import { FRAME_ORDER, FRAME_SPECS, HANGER_LABELS, sizeFor } from '../lib/frames';

interface Props {
  item: BoardItem;
  onChange: (patch: Partial<BoardItem>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onClose: () => void;
}

export default function ItemInspector({
  item,
  onChange,
  onCommit,
  onDelete,
  onBringToFront,
  onClose,
}: Props) {
  /** Width changes keep the media's proportions by re-deriving the height. */
  const resize = (width: number) => {
    if (item.aspect) {
      onChange({ ...sizeFor(item.frame, item.aspect, Boolean(item.caption), width) });
    } else {
      onChange({ w: width, h: Math.round((item.h / item.w) * width) });
    }
  };

  const changeFrame = (frame: FrameStyle) => {
    const patch: Partial<BoardItem> = { frame, hanger: FRAME_SPECS[frame].defaultHanger };
    if (item.aspect) Object.assign(patch, sizeFor(frame, item.aspect, Boolean(item.caption), item.w));
    onChange(patch);
    onCommit();
  };

  return (
    <aside className="inspector" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <span>Selected item</span>
        <button type="button" onClick={onClose} aria-label="Deselect">
          &times;
        </button>
      </header>

      <div className="inspector-body">
        <div className="field">
          <label>Frame</label>
          <div className="chooser">
            {FRAME_ORDER.map((frame) => (
              <button
                type="button"
                key={frame}
                className={item.frame === frame ? 'on' : ''}
                onClick={() => changeFrame(frame)}
              >
                {FRAME_SPECS[frame].label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Hangs by</label>
          <div className="chooser">
            {(Object.keys(HANGER_LABELS) as HangerStyle[]).map((hanger) => (
              <button
                type="button"
                key={hanger}
                className={item.hanger === hanger ? 'on' : ''}
                onClick={() => {
                  onChange({ hanger });
                  onCommit();
                }}
              >
                {HANGER_LABELS[hanger]}
              </button>
            ))}
          </div>
        </div>

        {item.hanger === 'pin' ? (
          <div className="field">
            <label>Pin colour</label>
            <div className="swatches">
              {PIN_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={color}
                  className={item.pinColor === color ? 'on' : ''}
                  style={{ background: color }}
                  onClick={() => {
                    onChange({ pinColor: color });
                    onCommit();
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label>Size &mdash; {item.w}px</label>
          <input
            type="range"
            min={100}
            max={900}
            value={item.w}
            onChange={(e) => resize(Number(e.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
        </div>

        <div className="field">
          <label>Tilt &mdash; {item.rotation}&deg;</label>
          <input
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={item.rotation}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
        </div>

        <div className="field">
          <label>Caption</label>
          <input
            type="text"
            value={item.caption ?? ''}
            onChange={(e) => onChange({ caption: e.target.value || undefined })}
            onBlur={onCommit}
          />
        </div>

        {item.body !== undefined || !item.mediaId ? (
          <div className="field">
            <label>Text</label>
            <textarea
              value={item.body ?? ''}
              onChange={(e) => onChange({ body: e.target.value || undefined })}
              onBlur={onCommit}
            />
          </div>
        ) : null}

        <div className="btn-row">
          <button className="btn ghost" type="button" onClick={onBringToFront}>
            Bring to front
          </button>
          <button className="btn danger" type="button" onClick={onDelete}>
            Take it down
          </button>
        </div>
      </div>
    </aside>
  );
}
