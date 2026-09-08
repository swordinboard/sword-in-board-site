import { memo } from 'react';
import type { BoardItem } from '../../shared/types';
import { mediaUrl } from '../lib/api';

interface Props {
  item: BoardItem;
  editable: boolean;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent, item: BoardItem) => void;
}

function Fastener({ item }: { item: BoardItem }) {
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

function Contents({ item }: { item: BoardItem }) {
  const image = item.mediaId ? (
    <img src={mediaUrl(item.mediaId)} alt={item.caption ?? ''} draggable={false} loading="lazy" />
  ) : null;

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

function BoardItemView({ item, editable, selected, dragging, onPointerDown }: Props) {
  return (
    <div
      className={[
        'item',
        `frame-${item.frame}`,
        editable ? 'editable' : '',
        selected ? 'selected' : '',
        dragging ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: dragging ? 9999 : item.z,
        transform: `rotate(${item.rotation}deg)`,
      }}
      onPointerDown={(event) => onPointerDown(event, item)}
    >
      <Fastener item={item} />
      <div className="surface">
        <Contents item={item} />
      </div>
    </div>
  );
}

export default memo(BoardItemView);
