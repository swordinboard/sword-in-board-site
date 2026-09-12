import { useState } from 'react';
import { MAX_GALLERY } from '../../shared/types';
import { mediaUrl, uploadMedia } from '../lib/api';
import { cropToBlob, loadImage, readFileAsDataUrl } from '../lib/image';

interface Props {
  boardId: string;
  mediaIds: string[];
  onChange: (ids: string[]) => void;
  /** Called once a change is settled, so the board saves. */
  onCommit: () => void;
  /** What is left in the board's picture allowance, counting these. */
  room?: number;
}

/**
 * The pictures inside a folder or a magazine, after it is on the wall.
 *
 * Everything about a gallery except its contents could be changed from the
 * inspector, which made the contents the one thing you had to take the item
 * down and build again to fix.
 */
export default function GalleryEditor({ boardId, mediaIds, onChange, onCommit, room }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowance = Math.min(MAX_GALLERY, room ?? MAX_GALLERY);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const space = allowance - mediaIds.length;
    if (space <= 0) {
      setError(`This one is full at ${MAX_GALLERY} pictures.`);
      return;
    }
    setBusy(true);
    try {
      const added: string[] = [];
      // Whole, not cropped: a gallery is about what is in it rather than how
      // each shot is framed, and cropping twenty at a time is nobody's idea
      // of an evening.
      for (const file of [...list].slice(0, space)) {
        const image = await loadImage(await readFileAsDataUrl(file));
        const blob = await cropToBlob(image, {
          x: 0,
          y: 0,
          w: image.naturalWidth,
          h: image.naturalHeight,
        });
        const { id } = await uploadMedia(blob, boardId);
        added.push(id);
      }
      onChange([...mediaIds, ...added]);
      onCommit();
      if (list.length > space) {
        setError(`Room for ${space} more, so the rest were left out.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    onChange(mediaIds.filter((other) => other !== id));
    onCommit();
  };

  const makeCover = (id: string) => {
    onChange([id, ...mediaIds.filter((other) => other !== id)]);
    onCommit();
  };

  return (
    <div className="gallery-editor">
      <div className="gallery-strip">
        {mediaIds.map((id, index) => (
          <div className="strip-cell" key={id}>
            <img src={mediaUrl(id)} alt="" loading="lazy" />
            {index === 0 ? (
              <span className="strip-first">cover</span>
            ) : (
              <button
                type="button"
                className="strip-promote"
                onClick={() => makeCover(id)}
                title="Put this one on the front"
              >
                &uarr;
              </button>
            )}
            <button type="button" aria-label="Take this one out" onClick={() => remove(id)}>
              &times;
            </button>
          </div>
        ))}
      </div>

      {mediaIds.length < allowance ? (
        <label className="dropzone small">
          <span>{busy ? 'Adding...' : 'Add pictures'}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <p className="hint-text">
          {mediaIds.length >= MAX_GALLERY
            ? `Full at ${MAX_GALLERY} pictures.`
            : 'The board has no room for more pictures.'}
        </p>
      )}

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
