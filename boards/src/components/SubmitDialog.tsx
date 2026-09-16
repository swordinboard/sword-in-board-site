import { useCallback, useState } from 'react';
import { createSubmission, mediaUrl, uploadMedia } from '../lib/api';
import { loadImage, readFileAsDataUrl } from '../lib/image';
import Scrim from './Scrim';

interface Props {
  /** The board being looked at; the submission is filed against it. */
  boardId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

interface Pending {
  id: string;
  preview: string;
}

const MAX_FILES = 8;
/** Longest edge for a submitted image before upload. */
const MAX_EDGE = 1800;

/** Re-encodes a chosen file so a phone photo does not blow the upload limit. */
async function shrink(file: File): Promise<Blob> {
  const image = await loadImage(await readFileAsDataUrl(file));
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not open a drawing canvas.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare that image.'))),
      'image/webp',
      0.88,
    );
  });
}

export default function SubmitDialog({ boardId, onClose, onDone }: Props) {
  const [submitter, setSubmitter] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const takeFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      setUploading(true);
      try {
        const room = MAX_FILES - pending.length;
        for (const file of [...files].slice(0, Math.max(0, room))) {
          const blob = await shrink(file);
          const { id } = await uploadMedia(blob, boardId);
          setPending((current) => [...current, { id, preview: mediaUrl(id, boardId) }]);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [pending.length, boardId],
  );

  const submit = async () => {
    if (!note.trim() && pending.length === 0) {
      setError('Add a note or at least one image.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSubmission(
        {
          submitter: submitter.trim() || 'Anonymous',
          contact: contact.trim() || undefined,
          note: note.trim(),
          mediaIds: pending.map((entry) => entry.id),
        },
        boardId,
      );
      onDone('Submission sent. It will be reviewed before it goes up.');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Scrim label="Make a submission" onClose={onClose}>
        <h2>Make a submission</h2>
        <p className="lede">
          Send media and a note about what you are going for. Nothing goes up automatically &mdash;
          it gets looked at first, then pinned in a finished form.
        </p>

        <div className="field">
          <label>Your name</label>
          <input
            type="text"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            placeholder="Who is this from?"
          />
        </div>

        <div className="field">
          <label>How to reach you (optional)</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email, handle, whatever works"
          />
        </div>

        <div className="field">
          <label>What you are going for</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is it, where it should sit, how it should look, anything worth knowing..."
          />
        </div>

        <div className="field">
          <label>Media</label>
          <label
            className={`dropzone${over ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void takeFiles(e.dataTransfer.files);
            }}
          >
            <span>
              {uploading
                ? 'Uploading...'
                : `Drop images here, or click to choose (up to ${MAX_FILES})`}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void takeFiles(e.target.files)}
            />
          </label>
          {pending.length > 0 ? (
            <div className="thumb-row">
              {pending.map((entry) => (
                <div className="thumb" key={entry.id}>
                  <img src={entry.preview} alt="" />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      setPending((current) => current.filter((item) => item.id !== entry.id))
                    }
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="btn-row">
          <button className="btn" type="button" onClick={submit} disabled={busy || uploading}>
            {busy ? 'Sending...' : 'Send it in'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
    </Scrim>
  );
}
