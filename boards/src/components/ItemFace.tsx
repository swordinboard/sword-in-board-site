import type { ReactNode } from 'react';
import type { FrameStyle, HangerStyle } from '../../shared/types';
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
  caption?: string;
  body?: string;
  mediaId?: string;
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
}

export function Contents({ item, media }: ContentsProps) {
  const image =
    media ??
    (item.mediaId ? (
      <img src={mediaUrl(item.mediaId)} alt={item.caption ?? ''} draggable={false} loading="lazy" />
    ) : null);

  // The framed style layers a mat and glass over the media, so it nests
  // differently from the flat styles.
  if (item.frame === 'framed') {
    return (
      <>
        <div className="mat">{image}</div>
        {item.caption ? <div className="caption">{item.caption}</div> : null}
      </>
    );
  }

  return (
    <div className="stack">
      {item.caption && item.frame === 'note' ? <div className="caption">{item.caption}</div> : null}
      {image ? <div className="media">{image}</div> : null}
      {item.body ? <div className="body-text">{item.body}</div> : null}
      {item.caption && item.frame !== 'note' ? <div className="caption">{item.caption}</div> : null}
    </div>
  );
}
