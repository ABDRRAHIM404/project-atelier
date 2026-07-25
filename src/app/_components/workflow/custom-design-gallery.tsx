'use client';

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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

type ImageTransform = Readonly<{
  scale: number;
  x: number;
  y: number;
}>;

type PointerPosition = Readonly<{
  x: number;
  y: number;
}>;

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;
const RESET_TRANSFORM: ImageTransform = { scale: MIN_SCALE, x: 0, y: 0 };

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
  const mediaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const transformRef = useRef<ImageTransform>(RESET_TRANSFORM);
  const [imageTransform, setImageTransform] = useState<ImageTransform>(RESET_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);
  const activeFile = files[activeIndex];

  const constrainTransform = useCallback((next: ImageTransform): ImageTransform => {
    const scale = Math.min(Math.max(next.scale, MIN_SCALE), MAX_SCALE);
    const media = mediaRef.current;
    const image = imageRef.current;

    if (!media || !image || scale === MIN_SCALE) {
      return { scale, x: 0, y: 0 };
    }

    const mediaRect = media.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || mediaRect.width;
    const naturalHeight = image.naturalHeight || mediaRect.height;
    const fitScale = Math.min(mediaRect.width / naturalWidth, mediaRect.height / naturalHeight);
    const renderedWidth = naturalWidth * fitScale * scale;
    const renderedHeight = naturalHeight * fitScale * scale;
    const maximumX = Math.max(0, (renderedWidth - mediaRect.width) / 2);
    const maximumY = Math.max(0, (renderedHeight - mediaRect.height) / 2);

    return {
      scale,
      x: Math.min(Math.max(next.x, -maximumX), maximumX),
      y: Math.min(Math.max(next.y, -maximumY), maximumY),
    };
  }, []);

  const commitTransform = useCallback(
    (next: ImageTransform) => {
      const constrained = constrainTransform(next);
      transformRef.current = constrained;
      setImageTransform(constrained);
    },
    [constrainTransform],
  );

  const resetImage = useCallback(() => {
    pointersRef.current.clear();
    setIsDragging(false);
    transformRef.current = RESET_TRANSFORM;
    setImageTransform(RESET_TRANSFORM);
  }, []);

  const zoomAt = useCallback(
    (requestedScale: number, clientX?: number, clientY?: number) => {
      const mediaRect = mediaRef.current?.getBoundingClientRect();
      const current = transformRef.current;
      const scale = Math.min(Math.max(requestedScale, MIN_SCALE), MAX_SCALE);

      if (!mediaRect || scale === MIN_SCALE) {
        commitTransform({ scale, x: 0, y: 0 });
        return;
      }

      const centerX = mediaRect.left + mediaRect.width / 2;
      const centerY = mediaRect.top + mediaRect.height / 2;
      const focalX = (clientX ?? centerX) - centerX;
      const focalY = (clientY ?? centerY) - centerY;
      const ratio = scale / current.scale;

      commitTransform({
        scale,
        x: focalX - (focalX - current.x) * ratio,
        y: focalY - (focalY - current.y) * ratio,
      });
    },
    [commitTransform],
  );

  const move = useCallback(
    (offset: number) => {
      resetImage();
      setActiveIndex((current) => (current + offset + files.length) % files.length);
    },
    [files.length, resetImage],
  );

  const selectFile = useCallback(
    (index: number) => {
      resetImage();
      setActiveIndex(index);
    },
    [resetImage],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser tests and older touch browsers may not expose pointer capture.
    }
    setIsDragging(transformRef.current.scale > MIN_SCALE);
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const previousPointer = pointersRef.current.get(event.pointerId);
      if (!previousPointer) return;

      event.preventDefault();
      const previousPointers = Array.from(pointersRef.current.values());
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const currentPointers = Array.from(pointersRef.current.values());
      const current = transformRef.current;

      if (currentPointers.length === 1) {
        if (current.scale > MIN_SCALE) {
          commitTransform({
            ...current,
            x: current.x + event.clientX - previousPointer.x,
            y: current.y + event.clientY - previousPointer.y,
          });
          setIsDragging(true);
        }
        return;
      }

      const [previousFirst, previousSecond] = previousPointers;
      const [currentFirst, currentSecond] = currentPointers;
      if (!previousFirst || !previousSecond || !currentFirst || !currentSecond) return;

      const previousDistance = Math.hypot(
        previousSecond.x - previousFirst.x,
        previousSecond.y - previousFirst.y,
      );
      const currentDistance = Math.hypot(
        currentSecond.x - currentFirst.x,
        currentSecond.y - currentFirst.y,
      );
      if (previousDistance === 0) return;

      const mediaRect = mediaRef.current?.getBoundingClientRect();
      if (!mediaRect) return;

      const requestedScale = Math.min(
        Math.max(current.scale * (currentDistance / previousDistance), MIN_SCALE),
        MAX_SCALE,
      );
      const ratio = requestedScale / current.scale;
      const previousCenterX = (previousFirst.x + previousSecond.x) / 2;
      const previousCenterY = (previousFirst.y + previousSecond.y) / 2;
      const currentCenterX = (currentFirst.x + currentSecond.x) / 2;
      const currentCenterY = (currentFirst.y + currentSecond.y) / 2;
      const mediaCenterX = mediaRect.left + mediaRect.width / 2;
      const mediaCenterY = mediaRect.top + mediaRect.height / 2;

      commitTransform({
        scale: requestedScale,
        x: currentCenterX - mediaCenterX - (previousCenterX - mediaCenterX - current.x) * ratio,
        y: currentCenterY - mediaCenterY - (previousCenterY - mediaCenterY - current.y) * ratio,
      });
      setIsDragging(true);
    },
    [commitTransform],
  );

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !activeFile?.mediaType.startsWith('image/')) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const scaleFactor = Math.exp(-event.deltaY * 0.002);
      zoomAt(transformRef.current.scale * scaleFactor, event.clientX, event.clientY);
    }

    media.addEventListener('wheel', handleWheel, { passive: false });
    return () => media.removeEventListener('wheel', handleWheel);
  }, [activeFile?.mediaType, zoomAt]);

  const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    setIsDragging(pointersRef.current.size > 0 && transformRef.current.scale > MIN_SCALE);
  }, []);

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
  const canReset =
    imageTransform.scale !== MIN_SCALE || imageTransform.x !== 0 || imageTransform.y !== 0;

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
          <div className="custom-design-gallery__header-actions">
            {isImage ? (
              <div
                aria-label="أدوات تكبير الصورة"
                className="custom-design-gallery__zoom"
                role="group"
              >
                <button
                  aria-label="تصغير الصورة"
                  disabled={imageTransform.scale <= MIN_SCALE}
                  onClick={() => zoomAt(imageTransform.scale - ZOOM_STEP)}
                  type="button"
                >
                  −
                </button>
                <output aria-live="polite">{Math.round(imageTransform.scale * 100)}٪</output>
                <button
                  aria-label="إعادة ضبط الصورة"
                  disabled={!canReset}
                  onClick={resetImage}
                  type="button"
                >
                  ↺
                </button>
                <button
                  aria-label="تكبير الصورة"
                  disabled={imageTransform.scale >= MAX_SCALE}
                  onClick={() => zoomAt(imageTransform.scale + ZOOM_STEP)}
                  type="button"
                >
                  +
                </button>
              </div>
            ) : null}
            <button
              aria-label="إغلاق معرض ملفات التصميم"
              className="custom-design-gallery__close"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          </div>
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

          <div
            aria-label={isImage ? 'منطقة عرض الصورة وسحبها' : undefined}
            className={
              isDragging
                ? 'custom-design-gallery__media custom-design-gallery__media--dragging'
                : 'custom-design-gallery__media'
            }
            onPointerCancel={isImage ? onPointerEnd : undefined}
            onPointerDown={isImage ? onPointerDown : undefined}
            onPointerMove={isImage ? onPointerMove : undefined}
            onPointerUp={isImage ? onPointerEnd : undefined}
            ref={mediaRef}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={activeFile.displayName}
                draggable={false}
                onLoad={() => commitTransform(transformRef.current)}
                ref={imageRef}
                src={activeFile.signedUrl}
                style={{
                  transform: `translate3d(${imageTransform.x}px, ${imageTransform.y}px, 0) scale(${imageTransform.scale})`,
                }}
              />
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
                onClick={() => selectFile(index)}
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
