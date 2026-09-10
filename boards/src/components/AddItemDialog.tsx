import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameStyle, HangerStyle } from '../../shared/types';
import { PIN_COLORS } from '../../shared/types';
import { uploadMedia } from '../lib/api';
import { cropToBlob, loadImage, readFileAsDataUrl, type CropRect } from '../lib/image';
import { FRAME_ORDER, FRAME_SPECS, HANGER_LABELS, randomTilt, sizeFor } from '../lib/frames';
import Cropper from './Cropper';
import Scrim from './Scrim';

export interface ItemDraft {
  mediaId?: string;
  aspect?: number;
  caption?: string;
  body?: string;
  frame: FrameStyle;
  hanger: HangerStyle;
  pinColor?: string;
  w: number;
  h: number;
  rotation: number;
}

interface Props {
  /** The board this item is being pinned to; media is filed against it. */
  boardId: string;
  /** Pre-loaded source, used when placing an image straight from a submission. */
  initialSrc?: string;
  onPlace: (draft: ItemDraft) => Promise<void> | void;
  onClose: () => void;
}

const RATIOS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: 'Square', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
];

export default function AddItemDialog({ boardId, initialSrc, onPlace, onClose }: Props) {
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [frame, setFrame] = useState<FrameStyle>('polaroid');
  const [hanger, setHanger] = useState<HangerStyle>('pin');
  const [pinColor, setPinColor] = useState<string>(PIN_COLORS[0]);
  const [caption, setCaption] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialSrc) return;
    loadImage(initialSrc).then(setImage).catch((e: Error) => setError(e.message));
  }, [initialSrc]);

  // The hanger follows the frame until the editor overrides it.
  const chooseFrame = (next: FrameStyle) => {
    setFrame(next);
    setHanger(FRAME_SPECS[next].defaultHanger);
    if (next === 'note') setMode('text');
  };

  const takeFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImage(await loadImage(dataUrl));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'text') {
        if (!body.trim() && !caption.trim()) {
          setError('Write something for the note to say.');
          setBusy(false);
          return;
        }
        await onPlace({
          caption: caption.trim() || undefined,
          body: body.trim() || undefined,
          frame,
          hanger,
          pinColor: hanger === 'pin' ? pinColor : undefined,
          w: 260,
          h: 240,
          rotation: randomTilt(frame),
        });
        return;
      }

      if (!image || !rect) {
        setError('Choose an image first.');
        setBusy(false);
        return;
      }
      const blob = await cropToBlob(image, rect);
      const { id } = await uploadMedia(blob, boardId);
      const aspect = rect.w / rect.h;
      const size = sizeFor(frame, aspect, Boolean(caption.trim()));
      await onPlace({
        mediaId: id,
        aspect,
        caption: caption.trim() || undefined,
        frame,
        hanger,
        pinColor: hanger === 'pin' ? pinColor : undefined,
        w: size.w,
        h: size.h,
        rotation: randomTilt(frame),
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Scrim label="Pin something up" onClose={onClose}>
        <h2>Pin something up</h2>
        <p className="lede">
          Crop it down to what matters, choose how it hangs, then drop it on the board.
        </p>

        <div className="field">
          <label>What is it</label>
          <div className="chooser">
            <button
              type="button"
              className={mode === 'image' ? 'on' : ''}
              onClick={() => setMode('image')}
            >
              A picture
            </button>
            <button
              type="button"
              className={mode === 'text' ? 'on' : ''}
              onClick={() => setMode('text')}
            >
              Something written
            </button>
          </div>
        </div>

        {mode === 'image' ? (
          <>
            {!image ? (
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
                  void takeFile(e.dataTransfer.files[0]);
                }}
              >
                <span>
                  Drop an image here, or click to choose one
                  <br />
                  <small>JPEG, PNG, WebP, or GIF</small>
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void takeFile(e.target.files?.[0])}
                />
              </label>
            ) : (
              <>
                <div className="field">
                  <label>Crop</label>
                  <div className="chooser">
                    {RATIOS.map((option) => (
                      <button
                        type="button"
                        key={option.label}
                        className={ratio === option.value ? 'on' : ''}
                        onClick={() => setRatio(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Cropper image={image} ratio={ratio} onChange={setRect} />
                <button className="btn ghost" type="button" onClick={() => setImage(null)}>
                  Choose a different image
                </button>
              </>
            )}
          </>
        ) : (
          <div className="field">
            <label>What it says</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the notice..."
            />
          </div>
        )}

        <div className="field" style={{ marginTop: 18 }}>
          <label>How it is framed</label>
          <div className="chooser">
            {FRAME_ORDER.map((option) => (
              <button
                type="button"
                key={option}
                className={frame === option ? 'on' : ''}
                onClick={() => chooseFrame(option)}
              >
                {FRAME_SPECS[option].label}
                <span className="sub">{FRAME_SPECS[option].blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>How it hangs</label>
          <div className="chooser">
            {(Object.keys(HANGER_LABELS) as HangerStyle[]).map((option) => (
              <button
                type="button"
                key={option}
                className={hanger === option ? 'on' : ''}
                onClick={() => setHanger(option)}
              >
                {HANGER_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {hanger === 'pin' ? (
          <div className="field">
            <label>Pin colour</label>
            <div className="swatches">
              {PIN_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={color}
                  className={pinColor === color ? 'on' : ''}
                  style={{ background: color }}
                  onClick={() => setPinColor(color)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label>Caption {mode === 'text' ? '(heading)' : '(optional)'}</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={mode === 'text' ? 'Notice' : 'A few words underneath'}
          />
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="btn-row">
          <button className="btn" type="button" onClick={submit} disabled={busy}>
            {busy ? 'Pinning...' : 'Pin it up'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
    </Scrim>
  );
}
