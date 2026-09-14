import type { ReactNode } from 'react';
import type { BoardLine, FrameStyle, HangerStyle, MagnetFinish } from '../../shared/types';
import { lineValue, todayIn } from '../../shared/clock';
import { mediaUrl } from '../lib/api';

/**
 * How a pinned item is drawn: the fastener holding it, and what it holds.
 *
 * Shared by the board and by the preview in the add dialog, deliberately. A
 * preview that redraws the frames in its own markup is a second implementation
 * that drifts from the first, and then it stops being a preview.
 */

export interface FaceItem {
  frame: FrameStyle;
  hanger: HangerStyle;
  pinColor?: string;
  finish?: MagnetFinish;
  /** What a note says, or the name on a folder tab or magazine cover. */
  body?: string;
  /** The line across the top of a written item. */
  heading?: string;
  /** Written on the white below an instant photo. */
  caption?: string;
  mediaId?: string;
  mediaIds?: string[];
  lines?: BoardLine[];
}

export function Fastener({ item }: { item: FaceItem }) {
  switch (item.hanger) {
    case 'pin':
      return (
        <span
          className="fastener pin"
          style={{ ['--pin' as string]: item.pinColor ?? '#c0392b' }}
          aria-hidden
        />
      );
    case 'nail':
      return <span className="fastener nail" aria-hidden />;
    case 'magnetBar':
    case 'magnetDisc':
      return (
        <span
          className={`fastener magnet ${item.hanger === 'magnetBar' ? 'bar' : 'disc'} ${
            item.finish ?? 'black'
          }`}
          aria-hidden
        />
      );
    case 'tape':
      return (
        <>
          <span className="fastener tape left" aria-hidden />
          <span className="fastener tape right" aria-hidden />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

interface ContentsProps {
  item: FaceItem;
  /** Stands in for the stored image, so a preview can show a live crop. */
  media?: ReactNode;
  /**
   * Today, in the board's zone. Passed in rather than read here so every
   * whiteboard on a board turns over together, off one timer instead of one
   * each, and so a test can put the board on any day it likes.
   */
  today?: string;
}

/**
 * The four lengths a frame is made of. They carry the moulding so it can be
 * mitred: a single background cannot be cut at 45 at its own corners, and
 * four bands laid over each other paint every corner twice.
 */
export function Moulding() {
  return (
    <>
      <span className="moulding top" aria-hidden />
      <span className="moulding bottom" aria-hidden />
      <span className="moulding left" aria-hidden />
      <span className="moulding right" aria-hidden />
    </>
  );
}

export function Contents({ item, media, today }: ContentsProps) {
  const gallery = item.mediaIds ?? [];
  const cover = gallery[0] ?? item.mediaId;

  const image =
    media ??
    (cover ? <img src={mediaUrl(cover)} alt="" draggable={false} loading="lazy" /> : null);

  // A whiteboard carries whatever was written on it and, under that, lines it
  // works out for itself. Either half can stand alone: a blank board is just
  // somewhere to write, and a board with no writing is just the numbers.
  if (item.frame === 'whiteboard') {
    const day = today ?? todayIn();
    const lines = item.lines ?? [];
    // A whiteboard written before the heading and the body were separated
    // kept its heading in `body` and had no body of its own, so that is how
    // one with no heading set is still read.
    const heading = item.heading ?? item.body;
    const written = item.heading === undefined ? undefined : item.body;
    // With labels in play the values line up down the right-hand side. With
    // none at all there is nothing to line up against, so they stay left
    // where the writing is.
    const labelled = lines.some((line) => line.label);
    return (
      <>
        <div className="wb-face">
          {heading ? <div className="wb-title">{heading}</div> : null}
          {written ? <div className="wb-body">{written}</div> : null}
          {lines.length ? (
            <div className={`wb-lines${labelled ? ' labelled' : ''}`}>
              {lines.map((line) => (
                <div className="wb-line" key={line.id}>
                  {line.label ? <span className="wb-label">{line.label}</span> : null}
                  <span className="wb-value">{lineValue(line, day)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <span className="wb-tray" aria-hidden />
        <span className="wb-marker" aria-hidden />
        <span className="wb-sheen" aria-hidden />
      </>
    );
  }

  // A folder is shown closed: a tab with its name, the top sheet peeking out,
  // and a count. Opening it is what shows the rest.
  if (item.frame === 'folder') {
    return (
      <>
        <div className="folder-tab">{item.body || 'Folder'}</div>
        <div className="folder-body">
          {/* The top picture taped to the front of a closed folder, rather
              than peeking out of a half-open one. */}
          <div className="folder-sheet">
            {image}
            <span className="tape-strip left" aria-hidden />
            <span className="tape-strip right" aria-hidden />
          </div>
          <span className="folder-count">{countLabel(gallery.length)}</span>
        </div>
      </>
    );
  }

  // A magazine leads with its cover, which is simply the first picture in it.
  if (item.frame === 'magazine') {
    return (
      <>
        <div className="mag-cover">{image}</div>
        {item.body ? <div className="mag-masthead">{item.body}</div> : null}
        <div className="mag-spine" aria-hidden />
        <div className="mag-wear" aria-hidden />
        <div className="mag-dogear" aria-hidden />
        <span className="mag-count">{countLabel(gallery.length)}</span>
      </>
    );
  }

  // The framed style layers a mat and glass over the media, so it nests
  // differently from the flat styles.
  if (item.frame === 'framed') {
    return (
      <>
        <Moulding />
        <div className="mat">{image}</div>
      </>
    );
  }

  return (
    <>
      <div className="stack">
        {item.frame === 'lined' ? <div className="tear" aria-hidden /> : null}
        {item.heading ? <div className="title-text">{item.heading}</div> : null}
        {image ? <div className="media">{image}</div> : null}
        {item.body ? <div className="body-text">{item.body}</div> : null}
      </div>
      {/*
        The caption sits in the white below the picture rather than in the
        flow above it, so however long it is it can never push the photograph
        up or the white strip down - the strip is a real measurement and the
        writing has to live inside it.

        Its length goes to the stylesheet so the writing can be sized to the
        room there is, which is what a hand does with a pen.
      */}
      {item.caption ? (
        <div
          className="photo-caption"
          style={{ ['--chars' as string]: Math.max(8, item.caption.length) }}
        >
          {item.caption}
        </div>
      ) : null}
    </>
  );
}

const countLabel = (n: number) => (n === 1 ? '1 picture' : `${n} pictures`);
