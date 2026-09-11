import { memo } from 'react';
import type { BoardItem } from '../../shared/types';
import { Contents, Fastener } from './ItemFace';

interface Props {
  item: BoardItem;
  editable: boolean;
  selected: boolean;
  dragging: boolean;
  /** Today in the board's zone; only a whiteboard uses it. */
  today: string;
  onPointerDown: (event: React.PointerEvent, item: BoardItem) => void;
}

function BoardItemView({ item, editable, selected, dragging, today, onPointerDown }: Props) {
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
        <Contents item={item} today={today} />
      </div>
    </div>
  );
}

export default memo(BoardItemView);
