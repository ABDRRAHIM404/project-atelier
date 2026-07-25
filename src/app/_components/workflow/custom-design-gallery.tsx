'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CustomDesignGalleryFile = Readonly<{
  displayName: string;
  mediaType: string;
  signedUrl: string;
}>;

type CustomDesignGalleryProps = Readonly<{
  files: readonly CustomDesignGalleryFile[];
  initialIndex: number;
  onClose: () => void;
}>;

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), iframe, [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden'));
}

export function CustomDesignGallery({ files, initialIndex, onClose }: CustomDesignGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), files.length - 1),
  );
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeFile = files[activeIndex];

  const move = useCallback(
    (offset: number) => {
      setActiveIndex((current) => (current + offset + files.length) % files.length);
    },
    [files.length],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight' && files.length > 1) {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === 'ArrowLeft' && files.length > 1) {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = focusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [files.length, move, onClose]);

  if (!activeFile) return null;

  const isImage = activeFile.mediaType.startsWith('image/');
  const hasMultipleFiles = files.length > 1;

  return (
    <div className="custom-design-gallery-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-describedby="custom-design-gallery-status"
        aria-labelledby="custom-design-gallery-title"
        aria-modal="true"
        className="custom-design-gallery"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <header className="custom-design-gallery__header">
          <div>
            <p className="eyebrow">ملفات العميل الخاصة</p>
            <h2 id="custom-design-gallery-title">{activeFile.displayName}</h2>
            <p aria-live="polite" id="custom-design-gallery-status">
              الملف {activeIndex + 1} من {files.length}
            </p>
          </div>
          <button
            aria-label="إغلاق معرض ملفات التصميم"
            className="custom-design-gallery__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="custom-design-gallery__viewer">
          {hasMultipleFiles ? (
            <button
              aria-label="الملف السابق"
              className="custom-design-gallery__navigation custom-design-gallery__navigation--previous"
              onClick={() => move(-1)}
              type="button"
            >
              <span aria-hidden="true">→</span>
            </button>
          ) : null}

          <div className="custom-design-gallery__media">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={activeFile.displayName} src={activeFile.signedUrl} />
            ) : (
              <iframe src={activeFile.signedUrl} title={`معاينة ${activeFile.displayName}`} />
            )}
          </div>

          {hasMultipleFiles ? (
            <button
              aria-label="الملف التالي"
              className="custom-design-gallery__navigation custom-design-gallery__navigation--next"
              onClick={() => move(1)}
              type="button"
            >
              <span aria-hidden="true">←</span>
            </button>
          ) : null}
        </div>

        {hasMultipleFiles ? (
          <div className="custom-design-gallery__thumbnails" aria-label="صور مصغرة لملفات التصميم">
            {files.map((file, index) => (
              <button
                aria-label={`عرض ${file.displayName}`}
                aria-pressed={index === activeIndex}
                className={
                  index === activeIndex
                    ? 'custom-design-gallery__thumbnail custom-design-gallery__thumbnail--active'
                    : 'custom-design-gallery__thumbnail'
                }
                key={`${file.signedUrl}-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {file.mediaType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={file.signedUrl} />
                ) : (
                  <span aria-hidden="true">PDF</span>
                )}
                <small>{file.displayName}</small>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
