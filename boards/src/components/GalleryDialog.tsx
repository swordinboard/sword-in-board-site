import { useEffect, useState } from 'react';
import type { BoardItem } from '../../shared/types';
import { mediaUrl } from '../lib/api';

interface Props {
  item: BoardItem;
  onClose: () => void;
}

/**
 * What is inside a folder or a magazine.
 *
 * Deliberately not the standard dialog: a gallery wants the whole screen and
 * a dark ground, and it is the one thing here that is looked at rather than
 * filled in.
 */
export default function GalleryDialog({ item, onClose }: Props) {
  const pictures = item.mediaIds?.length ? item.mediaIds : item.mediaId ? [item.mediaId] : [];
  const [at, setAt] = useState(0);

  const step = (by: number) =>
    setAt((current) => (current + by + pictures.length) % pictures.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (pictures.length === 0) return null;

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label={item.body || 'Pictures'}>
      <header>
        <h2>{item.body || (item.frame === 'magazine' ? 'Magazine' : 'Folder')}</h2>
        <span className="of">
          {at + 1} of {pictures.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className="gallery-main">
        {pictures.length > 1 ? (
          <button type="button" className="page prev" onClick={() => step(-1)} aria-label="Previous">
            &#8249;
          </button>
        ) : null}
        <img src={mediaUrl(pictures[at])} alt="" draggable={false} />
        {pictures.length > 1 ? (
          <button type="button" className="page next" onClick={() => step(1)} aria-label="Next">
            &#8250;
          </button>
        ) : null}
      </div>

      {pictures.length > 1 ? (
        <div className="gallery-thumbs">
          {pictures.map((id, index) => (
            <button
              type="button"
              key={id}
              className={index === at ? 'on' : ''}
              aria-label={`Picture ${index + 1}`}
              onClick={() => setAt(index)}
            >
              <img src={mediaUrl(id)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
