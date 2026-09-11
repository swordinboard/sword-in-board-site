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
  // A magazine opens the way a magazine does: two facing pages at a time.
  const spread = item.frame === 'magazine' && pictures.length > 1;
  const perTurn = spread ? 2 : 1;
  const [at, setAt] = useState(0);

  // Turning always lands on an even page in a spread, so the pairs stay put
  // rather than sliding by one and re-pairing every picture with the next.
  const step = (by: number) =>
    setAt((current) => {
      const turns = Math.ceil(pictures.length / perTurn);
      const now = Math.floor(current / perTurn);
      return (((now + by) % turns) + turns) % turns * perTurn;
    });

  const showing = pictures.slice(at, at + perTurn);
  const shownLabel =
    showing.length > 1 ? `${at + 1}-${at + showing.length} of ${pictures.length}` : `${at + 1} of ${pictures.length}`;

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
        <span className="of">{shownLabel}</span>
        <button type="button" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className={`gallery-main${spread ? ' spread' : ''}`}>
        {pictures.length > 1 ? (
          <button type="button" className="page prev" onClick={() => step(-1)} aria-label="Previous">
            &#8249;
          </button>
        ) : null}
        <div className="leaves">
          {showing.map((id) => (
            <img key={id} src={mediaUrl(id)} alt="" draggable={false} />
          ))}
        </div>
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
              className={index >= at && index < at + perTurn ? 'on' : ''}
              aria-label={`Picture ${index + 1}`}
              onClick={() => setAt(Math.floor(index / perTurn) * perTurn)}
            >
              <img src={mediaUrl(id)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
