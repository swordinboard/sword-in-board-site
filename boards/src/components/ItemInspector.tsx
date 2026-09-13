import type { BoardItem, BoardLine, FrameStyle, HangerStyle } from '../../shared/types';
import {
  GALLERY_FRAMES,
  MAGNET_FINISHES,
  MAGNET_HANGERS,
  MAX_TYPE_PT,
  MIN_TYPE_PT,
  PIN_COLORS,
} from '../../shared/types';
import { deviceZone } from '../../shared/clock';
import {
  FRAME_ORDER,
  FRAME_SPECS,
  HANGER_LABELS,
  PX_PER_INCH,
  sizeFor,
  takesImage,
  takesText,
} from '../lib/frames';
import { useEffect, useState } from 'react';
import { useToday, zoneOptions } from '../lib/clock';
import { heightForContent } from '../lib/fit';
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
  /** Taking something down cannot be undone, so it is asked twice. */
  const [confirming, setConfirming] = useState(false);

  /**
   * Anything holding a picture keeps the shape it was given, and one slider
   * settles it: the crop was chosen when the item went up, and a height set
   * on its own would quietly throw that away.
   *
   * Writing has no shape of its own, and wanting a wide notice or a long
   * narrow list is the ordinary case rather than the odd one, so those get
   * the two separately.
   */
  const shaped = Boolean(item.aspect || item.mediaId || item.mediaIds?.length);

  /** There is something on it whose height is worth fitting to. */
  const written = Boolean(item.body || item.heading || item.lines?.length);
  /** Frames that carry writing whose size is worth choosing. */
  const carriesType = takesText(item.frame) || item.frame === 'polaroid';
  /**
   * The size the frame would work out for itself, near enough, so the slider
   * has somewhere sensible to start rather than jumping the moment it is
   * touched. Twelve point is the floor everything else is built on.
   */
  const typeNow = item.typeSize ?? Math.max(12, Math.round((item.w * 0.02 * 72) / PX_PER_INCH));

  /** What this item would need to be to show everything on it. */
  const needed = () =>
    heightForContent(document.querySelector<HTMLElement>(`[data-item="${item.id}"]`));

  /**
   * Sets the height to whatever is actually on the item.
   *
   * Text that runs past the bottom of its sheet is simply cut off, and the
   * only way out used to be widening the whole thing until it happened to
   * fit. This gives it the room it asked for - or takes back the room it
   * never used.
   */
  const fitToText = () => {
    const next = needed();
    if (next === null || next === item.h) return;
    onChange({ h: next });
    onCommit();
  };

  /*
   * An item holding a picture has no height of its own to set, so writing on
   * one has to make it taller by itself. Otherwise a headline and a story
   * added to a clipping have nowhere to go: either they squeeze the
   * photograph or they fall off the bottom.
   *
   * Keyed on what actually changes the room needed - the writing, and the
   * width it has to wrap into - and it runs on opening the settings too, so
   * anything pinned up before this squares itself up as soon as it is
   * looked at.
   */
  useEffect(() => {
    // Any item with a picture, not only one that currently has writing: take
    // the writing off again and it should shrink back to the photograph.
    if (!item.aspect) return;
    const next = needed();
    if (next === null || Math.abs(next - item.h) <= 1) return;
    onChange({ h: next });
    onCommit();
    // onChange and onCommit are made afresh on every render; depending on
    // them would run this on every render rather than on a real change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.aspect, item.w, item.body, item.heading, item.typeSize]);

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

        {carriesType ? (
          <div className="field">
            <label>Writing &mdash; {typeNow}pt</label>
            <input
              type="range"
              min={MIN_TYPE_PT}
              max={MAX_TYPE_PT}
              value={typeNow}
              onChange={(e) => onChange({ typeSize: Number(e.target.value) })}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
            />
            {item.typeSize ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  onChange({ typeSize: undefined });
                  onCommit();
                }}
              >
                Back to the frame's own size
              </button>
            ) : null}
          </div>
        ) : null}

        {MAGNET_HANGERS.includes(item.hanger) ? (
          <div className="field">
            <label>Magnet finish</label>
            <div className="chooser">
              {MAGNET_FINISHES.map((finish) => (
                <button
                  type="button"
                  key={finish}
                  className={(item.finish ?? 'black') === finish ? 'on' : ''}
                  onClick={() => {
                    onChange({ finish });
                    onCommit();
                  }}
                >
                  {finish === 'black' ? 'Plain black' : 'Chrome'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
          <label>
            {shaped ? 'Size' : 'Width'} &mdash; {(item.w / PX_PER_INCH).toFixed(1)}&Prime;
          </label>
          {/* A board is thirty-six inches across, so nothing should stop at
              the eight inches the old limit allowed. */}
          <input
            type="range"
            min={100}
            max={2600}
            value={item.w}
            onChange={(e) => resize(Number(e.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
          />
        </div>

        {shaped ? (
          <p className="hint-text">
            The height follows the width, so it keeps the shape the picture was cropped to.
          </p>
        ) : (
          <div className="field">
            <label>Height &mdash; {(item.h / PX_PER_INCH).toFixed(1)}&Prime;</label>
            <input
              type="range"
              min={100}
              max={2600}
              value={item.h}
              onChange={(e) => onChange({ h: Number(e.target.value) })}
              onPointerUp={onCommit}
              onKeyUp={onCommit}
            />
            {written ? (
              <button className="btn ghost" type="button" onClick={fitToText}>
                Fit to what is on it
              </button>
            ) : null}
          </div>
        )}

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
          <>
            <div className="field">
              <label>{item.frame === 'clipping' ? 'Headline' : 'Title'}</label>
              <input
                type="text"
                value={item.heading ?? ''}
                maxLength={200}
                placeholder="Optional"
                onChange={(e) => onChange({ heading: e.target.value || undefined })}
                onBlur={onCommit}
              />
            </div>

            <div className="field">
              <label>Text</label>
              <textarea
                value={item.body ?? ''}
                onChange={(e) => onChange({ body: e.target.value || undefined })}
                onBlur={onCommit}
              />
            </div>
          </>
        ) : item.frame === 'polaroid' ? (
          <div className="field">
            <label>Written underneath</label>
            <input
              type="text"
              value={item.caption ?? ''}
              maxLength={160}
              placeholder="Optional"
              onChange={(e) => onChange({ caption: e.target.value || undefined })}
              onBlur={onCommit}
            />
            <p className="hint-text">
              It goes on the white below the picture, and is written smaller the more of it
              there is. The white strip stays the size an instant photo's is.
            </p>
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

        {confirming ? (
          <div className="danger-zone">
            <p>
              Take this down? There is no undo and nothing keeps a copy, so whatever is on it
              is gone.
            </p>
            <div className="actions">
              <button className="btn danger" type="button" onClick={onDelete}>
                Take it down
              </button>
              <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
                Leave it up
              </button>
            </div>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn ghost" type="button" onClick={onBringToFront}>
              Bring to front
            </button>
            <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
              Take it down
            </button>
          </div>
        )}
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
