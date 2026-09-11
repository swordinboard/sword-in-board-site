import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardLine, FrameStyle, HangerStyle } from '../../shared/types';
import { GALLERY_FRAMES, PIN_COLORS } from '../../shared/types';
import { uploadMedia } from '../lib/api';
import { cropToBlob, loadImage, readFileAsDataUrl, type CropRect } from '../lib/image';
import {
  FRAME_ORDER,
  FRAME_SPECS,
  HANGER_LABELS,
  TEXT_FRAMES,
  randomTilt,
  sizeFor,
  textSizeFor,
} from '../lib/frames';
import { useToday } from '../lib/clock';
import Cropper from './Cropper';
import FramePreview from './FramePreview';
import LinesEditor from './LinesEditor';
import Scrim from './Scrim';

export interface ItemDraft {
  mediaId?: string;
  mediaIds?: string[];
  aspect?: number;
  body?: string;
  lines?: BoardLine[];
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
  /** The board's clock, so a whiteboard previews the day it really will show. */
  timeZone?: string;
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

export default function AddItemDialog({ boardId, timeZone, initialSrc, onPlace, onClose }: Props) {
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [frame, setFrame] = useState<FrameStyle>('polaroid');
  const [hanger, setHanger] = useState<HangerStyle>('pin');
  const [pinColor, setPinColor] = useState<string>(PIN_COLORS[0]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  /** For a folder or magazine: the pictures filed in it, in order. */
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [name, setName] = useState('');
  /** A whiteboard's live lines, set up before it ever goes on the wall. */
  const [lines, setLines] = useState<BoardLine[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = useToday(timeZone);

  useEffect(() => {
    if (!initialSrc) return;
    loadImage(initialSrc).then(setImage).catch((e: Error) => setError(e.message));
  }, [initialSrc]);

  // A folder and a magazine hold a set of pictures rather than one, so they
  // take a different half of this dialog: many files, no cropping.
  const isGallery = GALLERY_FRAMES.includes(frame);
  const isWhiteboard = frame === 'whiteboard';

  // The hanger follows the frame until the editor overrides it.
  const chooseFrame = (next: FrameStyle) => {
    setFrame(next);
    setHanger(FRAME_SPECS[next].defaultHanger);
    // These are for writing on rather than for a picture.
    if (TEXT_FRAMES.includes(next)) setMode('text');
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

  const takeFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setFiles((current) => [
      ...current,
      ...[...list].map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isGallery) {
        if (files.length === 0) {
          setError('Put at least one picture in it.');
          setBusy(false);
          return;
        }
        // Each picture goes in whole. Cropping sixty of them one at a time is
        // not a thing anybody would sit through, and a gallery is about what
        // is in it rather than how each shot is framed.
        const ids: string[] = [];
        for (const entry of files) {
          const image = await loadImage(await readFileAsDataUrl(entry.file));
          const blob = await cropToBlob(image, {
            x: 0,
            y: 0,
            w: image.naturalWidth,
            h: image.naturalHeight,
          });
          const { id } = await uploadMedia(blob, boardId);
          ids.push(id);
        }
        const size = sizeFor(frame, 1);
        await onPlace({
          mediaIds: ids,
          body: name.trim() || undefined,
          frame,
          hanger,
          pinColor: hanger === 'pin' ? pinColor : undefined,
          w: size.w,
          h: size.h,
          rotation: randomTilt(frame),
        });
        return;
      }

      if (mode === 'text') {
        // A whiteboard keeping the date is worth pinning up with nothing
        // written on it at all; everything else needs words to be anything.
        if (!body.trim() && !lines.length) {
          setError(
            isWhiteboard
              ? 'Write something on it, or give it a line to keep.'
              : 'Write something for the note to say.',
          );
          setBusy(false);
          return;
        }
        const size = textSizeFor(frame);
        await onPlace({
          body: body.trim() || undefined,
          lines: lines.length ? lines : undefined,
          frame,
          hanger,
          pinColor: hanger === 'pin' ? pinColor : undefined,
          w: size.w,
          h: size.h,
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
      const size = sizeFor(frame, aspect);
      await onPlace({
        mediaId: id,
        aspect,
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

        <div className="field" hidden={isGallery}>
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

        {isGallery ? (
          <>
            <div className="field">
              <label>Name on it</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={frame === 'folder' ? 'What is filed in here' : 'The cover line'}
              />
            </div>

            <div className="field">
              <label>Pictures {files.length ? `(${files.length})` : ''}</label>
              <label className="dropzone">
                <span>
                  Choose pictures, or drop them here
                  <br />
                  <small>The first one is the {frame === 'folder' ? 'top sheet' : 'cover'}</small>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => takeFiles(e.target.files)}
                />
              </label>
            </div>

            {files.length ? (
              <div className="gallery-strip">
                {files.map((entry, index) => (
                  <div className="strip-cell" key={entry.preview}>
                    <img src={entry.preview} alt="" />
                    {index === 0 ? <span className="strip-first">first</span> : null}
                    <button
                      type="button"
                      aria-label="Take this one out"
                      onClick={() => {
                        URL.revokeObjectURL(entry.preview);
                        setFiles((current) => current.filter((c) => c !== entry));
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : mode === 'image' ? (
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
          <>
            <div className="field">
              <label>{isWhiteboard ? 'Written on it' : 'What it says'}</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={isWhiteboard ? 'The heading, if it wants one...' : 'Write the notice...'}
              />
            </div>

            {isWhiteboard ? (
              <div className="field">
                <label>Lines it keeps</label>
                <LinesEditor lines={lines} onChange={setLines} today={today} />
                <p className="hint-text">
                  These work themselves out every time the board is looked at, so nobody has to
                  come back and change the number.
                </p>
              </div>
            ) : null}
          </>
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
          <label>How it will hang</label>
          <FramePreview
            image={mode === 'image' && !isGallery ? image : null}
            rect={mode === 'image' && !isGallery ? rect : null}
            frame={frame}
            hanger={hanger}
            pinColor={pinColor}
            body={isGallery ? name : mode === 'text' ? body : undefined}
            lines={isWhiteboard ? lines : undefined}
            today={today}
            galleryCount={isGallery ? files.length : undefined}
            galleryCover={isGallery ? files[0]?.preview : undefined}
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
