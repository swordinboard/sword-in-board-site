import type { BoardItem, BoardLine, FrameStyle, HangerStyle } from '../../shared/types';
import { GALLERY_FRAMES } from '../../shared/types';
import { PIN_COLORS } from '../../shared/types';
import { deviceZone } from '../../shared/clock';
import { FRAME_ORDER, FRAME_SPECS, HANGER_LABELS, sizeFor, takesImage, takesText } from '../lib/frames';
import { useToday, zoneOptions } from '../lib/clock';
import GalleryEditor from './GalleryEditor';
import LinesEditor from './LinesEditor';

interface Props {
  item: BoardItem;
  /** The board this item is on; pictures added here are filed against it. */
  boardId: string;
  /** Pictures the board has room for beyond the ones already in this item. */
  roomForPictures: number;
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
  boardId,
  roomForPictures,
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

  // A frame decides what it will hold, so an item can only move between the
  // frames that hold what is already in it. Otherwise picking "sticky note"
  // on a photograph leaves an item whose contents it refuses to draw.
  const isGallery = GALLERY_FRAMES.includes(item.frame);
  const frameChoices = FRAME_ORDER.filter((frame) =>
    isGallery
      ? GALLERY_FRAMES.includes(frame)
      : item.mediaId
        ? takesImage(frame)
        : takesText(frame),
  );

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
          <label htmlFor="item-frame">Frame</label>
          <select
            id="item-frame"
            value={item.frame}
            onChange={(e) => changeFrame(e.target.value as FrameStyle)}
          >
            {frameChoices.map((frame) => (
              <option key={frame} value={frame}>
                {FRAME_SPECS[frame].label}
              </option>
            ))}
          </select>
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

        {isGallery ? (
          <>
            <div className="field">
              <label>Name on it</label>
              <input
                type="text"
                value={item.body ?? ''}
                onChange={(e) => onChange({ body: e.target.value || undefined })}
                onBlur={onCommit}
              />
            </div>

            <div className="field">
              <label>Pictures &mdash; {(item.mediaIds ?? []).length}</label>
              <GalleryEditor
                boardId={boardId}
                mediaIds={item.mediaIds ?? []}
                room={roomForPictures + (item.mediaIds ?? []).length}
                onChange={(mediaIds) => onChange({ mediaIds })}
                onCommit={onCommit}
              />
            </div>
          </>
        ) : item.frame === 'whiteboard' ? (
          <>
            <div className="field">
              <label>Heading</label>
              <input
                type="text"
                value={headingOf(item)}
                maxLength={200}
                onChange={(e) => onChange({ heading: e.target.value })}
                onBlur={onCommit}
              />
            </div>

            <div className="field">
              <label>Written on it</label>
              <textarea
                value={writtenOf(item)}
                onChange={(e) =>
                  // Setting the heading at the same time settles which of the
                  // two an older board's single piece of text was.
                  onChange({ heading: headingOf(item), body: e.target.value || undefined })
                }
                onBlur={onCommit}
              />
            </div>
          </>
        ) : takesText(item.frame) ? (
          <div className="field">
            <label>Text</label>
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
              <label>Date lines</label>
              <LinesEditor
                lines={item.lines ?? []}
                onChange={(lines: BoardLine[]) => onChange({ lines })}
                onCommit={onCommit}
                today={today}
              />
            </div>

            <div className="field">
              <label htmlFor="board-clock">Board clock</label>
              <select
                id="board-clock"
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

/**
 * The two halves of a whiteboard's writing, read the same way the face reads
 * them: a board from before they were separated kept its heading in `body`.
 */
const headingOf = (item: BoardItem) => item.heading ?? item.body ?? '';
const writtenOf = (item: BoardItem) => (item.heading === undefined ? '' : (item.body ?? ''));
