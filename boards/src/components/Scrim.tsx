import { useRef, type ReactNode } from 'react';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The dark backdrop behind a dialog, and the rule for dismissing by tapping it.
 *
 * Closing needs a tap that both starts and ends on the backdrop itself. Closing
 * on pointerdown alone, which is what every dialog used to do, meant a thumb
 * that landed a few pixels wide of a button dismissed the whole dialog — on a
 * phone that is indistinguishable from the button silently doing nothing, and
 * it is exactly how "the invite codes will not generate" looked.
 */
export default function Scrim({ label, onClose, children }: Props) {
  const startedOnScrim = useRef(false);

  return (
    <div
      className="modal-scrim"
      onPointerDown={(e) => {
        startedOnScrim.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (startedOnScrim.current && e.target === e.currentTarget) onClose();
        startedOnScrim.current = false;
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
