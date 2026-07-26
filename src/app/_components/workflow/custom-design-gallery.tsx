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

type FittedImageSize = Readonly<{
  height: number;
  source: string;
  width: number;
}>;

type PointerPosition = Readonly<{
  x: number;
  y: number;
}>;

type PointerGesture = {
  maximumPointers: number;
  moved: boolean;
  startX: number;
  startY: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;
const CONTROLS_IDLE_DELAY_MS = 2_800;
const TAP_MOVEMENT_TOLERANCE = 8;
const RESET_TRANSFORM: ImageTransform = { scale: MIN_SCALE, x: 0, y: 0 };

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), iframe, [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute('hidden') &&
      !element.closest('[inert]') &&
      !element.closest('[aria-hidden="true"]'),
  );
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
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const transformRef = useRef<ImageTransform>(RESET_TRANSFORM);
  const [imageTransform, setImageTransform] = useState<ImageTransform>(RESET_TRANSFORM);
  const [fittedImageSize, setFittedImageSize] = useState<FittedImageSize | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const activeFile = files[activeIndex];
  const activeImageSource = activeFile?.signedUrl;

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

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer();
    controlsTimerRef.current = window.setTimeout(() => {
      controlsTimerRef.current = null;
      if (pointersRef.current.size > 0) return;

      const activeElement = document.activeElement;
      const focusedControl =
        activeElement instanceof HTMLElement
          ? activeElement.closest<HTMLElement>('[data-gallery-control="true"]')
          : null;
      if (focusedControl && activeElement?.matches(':focus-visible')) return;

      if (focusedControl) mediaRef.current?.focus({ preventScroll: true });
      setControlsVisible(false);
    }, CONTROLS_IDLE_DELAY_MS);
  }, [clearControlsTimer]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const toggleControls = useCallback(() => {
    setControlsVisible((current) => {
      const next = !current;
      if (next) scheduleControlsHide();
      else clearControlsTimer();
      return next;
    });
  }, [clearControlsTimer, scheduleControlsHide]);

  const fitImageToViewport = useCallback(
    (resetToFittedView: boolean) => {
      const media = mediaRef.current;
      const image = imageRef.current;
      if (
        !media ||
        !image ||
        !activeImageSource ||
        image.naturalWidth <= 0 ||
        image.naturalHeight <= 0
      ) {
        return;
      }

      const mediaRect = media.getBoundingClientRect();
      if (mediaRect.width <= 0 || mediaRect.height <= 0) return;

      const fitScale = Math.min(
        mediaRect.width / image.naturalWidth,
        mediaRect.height / image.naturalHeight,
      );
      const nextSize = {
        height: image.naturalHeight * fitScale,
        source: activeImageSource,
        width: image.naturalWidth * fitScale,
      };

      setFittedImageSize((current) => {
        if (
          current?.source === nextSize.source &&
          Math.abs(current.width - nextSize.width) < 0.1 &&
          Math.abs(current.height - nextSize.height) < 0.1
        ) {
          return current;
        }
        return nextSize;
      });

      if (resetToFittedView) resetImage();
      else commitTransform(transformRef.current);
    },
    [activeImageSource, commitTransform, resetImage],
  );

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
      showControls();
      setActiveIndex((current) => (current + offset + files.length) % files.length);
    },
    [files.length, resetImage, showControls],
  );

  const selectFile = useCallback(
    (index: number) => {
      resetImage();
      showControls();
      setActiveIndex(index);
    },
    [resetImage, showControls],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (pointersRef.current.size === 0) {
      pointerGestureRef.current = {
        maximumPointers: 1,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
    } else if (pointerGestureRef.current) {
      pointerGestureRef.current.maximumPointers = Math.max(
        pointerGestureRef.current.maximumPointers,
        pointersRef.current.size + 1,
      );
      pointerGestureRef.current.moved = true;
    }
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
      if (event.pointerType === 'mouse') showControls();
      const previousPointer = pointersRef.current.get(event.pointerId);
      if (!previousPointer) return;

      event.preventDefault();
      const gesture = pointerGestureRef.current;
      if (
        gesture &&
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >
          TAP_MOVEMENT_TOLERANCE
      ) {
        gesture.moved = true;
      }
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
    [commitTransform, showControls],
  );

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !activeFile?.mediaType.startsWith('image/')) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      showControls();
      const scaleFactor = Math.exp(-event.deltaY * 0.002);
      zoomAt(transformRef.current.scale * scaleFactor, event.clientX, event.clientY);
    }

    media.addEventListener('wheel', handleWheel, { passive: false });
    return () => media.removeEventListener('wheel', handleWheel);
  }, [activeFile?.mediaType, showControls, zoomAt]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !activeFile?.mediaType.startsWith('image/')) return;

    const observer = new ResizeObserver(() => fitImageToViewport(false));
    observer.observe(media);

    if (imageRef.current?.complete) fitImageToViewport(true);
    return () => observer.disconnect();
  }, [activeFile?.mediaType, activeImageSource, fitImageToViewport]);

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(event.pointerId);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      const hasActivePointers = pointersRef.current.size > 0;
      setIsDragging(hasActivePointers && transformRef.current.scale > MIN_SCALE);
      if (hasActivePointers) return;

      const gesture = pointerGestureRef.current;
      pointerGestureRef.current = null;
      if (gesture && !gesture.moved && gesture.maximumPointers === 1) toggleControls();
      else showControls();
    },
    [showControls, toggleControls],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerGestureRef.current) pointerGestureRef.current.moved = true;
      onPointerEnd(event);
    },
    [onPointerEnd],
  );

  useEffect(() => {
    scheduleControlsHide();
    return clearControlsTimer;
  }, [activeIndex, clearControlsTimer, scheduleControlsHide]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mediaRef.current?.focus({ preventScroll: true });

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
  const activeFittedImageSize =
    fittedImageSize?.source === activeFile.signedUrl ? fittedImageSize : null;
  const galleryClassName = controlsVisible
    ? 'custom-design-gallery'
    : 'custom-design-gallery custom-design-gallery--controls-hidden';

  return (
    <div className="custom-design-gallery-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-describedby="custom-design-gallery-status"
        aria-labelledby="custom-design-gallery-title"
        aria-modal="true"
        className={galleryClassName}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <header
          aria-hidden={!controlsVisible}
          className="custom-design-gallery__header"
          data-gallery-control="true"
          inert={!controlsVisible}
        >
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
              aria-hidden={!controlsVisible}
              className="custom-design-gallery__navigation custom-design-gallery__navigation--previous"
              data-gallery-control="true"
              inert={!controlsVisible}
              onClick={() => move(-1)}
              tabIndex={controlsVisible ? 0 : -1}
              type="button"
            >
              <span aria-hidden="true">→</span>
            </button>
          ) : null}

          <div
            aria-label={isImage ? 'منطقة عرض الصورة وسحبها' : undefined}
            aria-pressed={isImage ? controlsVisible : undefined}
            className={
              isDragging
                ? 'custom-design-gallery__media custom-design-gallery__media--dragging'
                : 'custom-design-gallery__media'
            }
            onPointerCancel={isImage ? onPointerCancel : undefined}
            onPointerDown={isImage ? onPointerDown : undefined}
            onPointerMove={isImage ? onPointerMove : undefined}
            onPointerUp={isImage ? onPointerEnd : undefined}
            onKeyDown={
              isImage
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleControls();
                    }
                  }
                : undefined
            }
            ref={mediaRef}
            role={isImage ? 'button' : undefined}
            tabIndex={isImage ? 0 : undefined}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={activeFile.displayName}
                draggable={false}
                key={activeFile.signedUrl}
                onLoad={() => fitImageToViewport(true)}
                ref={imageRef}
                src={activeFile.signedUrl}
                style={{
                  height: activeFittedImageSize?.height ?? 0,
                  transform: `translate3d(${imageTransform.x}px, ${imageTransform.y}px, 0) scale(${imageTransform.scale})`,
                  visibility: activeFittedImageSize ? 'visible' : 'hidden',
                  width: activeFittedImageSize?.width ?? 0,
                }}
              />
            ) : (
              <iframe src={activeFile.signedUrl} title={`معاينة ${activeFile.displayName}`} />
            )}
          </div>

          {hasMultipleFiles ? (
            <button
              aria-label="الملف التالي"
              aria-hidden={!controlsVisible}
              className="custom-design-gallery__navigation custom-design-gallery__navigation--next"
              data-gallery-control="true"
              inert={!controlsVisible}
              onClick={() => move(1)}
              tabIndex={controlsVisible ? 0 : -1}
              type="button"
            >
              <span aria-hidden="true">←</span>
            </button>
          ) : null}
        </div>

        {hasMultipleFiles ? (
          <div
            aria-hidden={!controlsVisible}
            aria-label="صور مصغرة لملفات التصميم"
            className="custom-design-gallery__thumbnails"
            data-gallery-control="true"
            inert={!controlsVisible}
          >
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
