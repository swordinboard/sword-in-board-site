import type { BoardItem, BoardLine, FrameStyle, HangerStyle } from '../../shared/types';
import { GALLERY_FRAMES } from '../../shared/types';
import { PIN_COLORS } from '../../shared/types';
import { deviceZone } from '../../shared/clock';
import { FRAME_ORDER, FRAME_SPECS, HANGER_LABELS, sizeFor } from '../lib/frames';
import { useToday, zoneOptions } from '../lib/clock';
import LinesEditor from './LinesEditor';

interface Props {
  item: BoardItem;
  /** The clock the whole board counts against, not this item's alone. */
  timeZone?: string;
  onTimeZone: (zone: string) => void;
  onChange: (patch: Partial<BoardItem>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onClose: () => void;
}

export default function ItemInspector({
  item,
  timeZone,
  onTimeZone,
  onChange,
  onCommit,
  onDelete,
  onBringToFront,
  onClose,
}: Props) {
  const today = useToday(timeZone);

  /** Width changes keep the media's proportions by re-deriving the height. */
  const resize = (width: number) => {
    if (item.aspect) {
      onChange({ ...sizeFor(item.frame, item.aspect, width) });
    } else {
      onChange({ w: width, h: Math.round((item.h / item.w) * width) });
    }
  };

  const changeFrame = (frame: FrameStyle) => {
    const patch: Partial<BoardItem> = { frame, hanger: FRAME_SPECS[frame].defaultHanger };
    if (item.aspect) Object.assign(patch, sizeFor(frame, item.aspect, item.w));
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

        {GALLERY_FRAMES.includes(item.frame) ? (
          <div className="field">
            <label>Name on it</label>
            <input
              type="text"
              value={item.body ?? ''}
              onChange={(e) => onChange({ body: e.target.value || undefined })}
              onBlur={onCommit}
            />
          </div>
        ) : item.body !== undefined || !item.mediaId ? (
          <div className="field">
            <label>{item.frame === 'whiteboard' ? 'Written on it' : 'Text'}</label>
            <textarea
              value={item.body ?? ''}
              onChange={(e) => onChange({ body: e.target.value || undefined })}
              onBlur={onCommit}
            />
          </div>
        ) : null}

        {item.frame === 'whiteboard' ? (
          <>
            <div className="field">
              <label>Lines it keeps</label>
              <LinesEditor
                lines={item.lines ?? []}
                onChange={(lines: BoardLine[]) => onChange({ lines })}
                onCommit={onCommit}
                today={today}
              />
            </div>

            <div className="field">
              <label>Board clock</label>
              <select
                value={timeZone || deviceZone()}
                onChange={(e) => onTimeZone(e.target.value)}
              >
                {zoneOptions(timeZone).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="hint-text">
                Every whiteboard on this board counts against this clock, so a table spread
                across three timezones still reads the same day.
              </p>
            </div>
          </>
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
