'use client';

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export function CustomDesignForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const previews = useMemo(
    () => files.map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })),
    [files],
  );

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const valid = incoming.filter((file) => allowedTypes.has(file.type) && file.size <= 10 * 1024 * 1024);
    if (valid.length !== incoming.length) setError('بعض الملفات غير مدعومة أو تتجاوز 10 ميغابايت.');
    else setError('');
    setFiles((current) => [...current, ...valid].slice(0, 8));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) addFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setError('أضف صورة أو ملف PDF واحدًا على الأقل.');
      return;
    }
    setBusy(true);
    setProgress(15);
    setError('');
    const form = new FormData(event.currentTarget);
    files.forEach((file) => form.append('files', file));
    try {
      const timer = window.setInterval(() => setProgress((value) => Math.min(value + 8, 88)), 350);
      const response = await fetch('/api/v1/custom-designs', { body: form, method: 'POST' });
      window.clearInterval(timer);
      const payload = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(payload.detail ?? 'تعذر إرسال التصميم.');
      setProgress(100);
      window.setTimeout(() => router.push('/workspace?sent=custom-design'), 450);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إرسال التصميم.');
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <form className="custom-design-form" onSubmit={submit}>
      <section
        className={`fancy-uploader${dragging ? ' fancy-uploader--dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
      >
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hidden
          multiple
          onChange={onFileChange}
          ref={inputRef}
          type="file"
        />
        <span className="fancy-uploader__icon" aria-hidden="true">↑</span>
        <h2>ارفع تصميم الأثاث</h2>
        <p>اسحب الصور أو ملف PDF هنا، أو اخترها من جهازك.</p>
        <small>JPG، PNG، WEBP، PDF · حتى 10 ميغابايت لكل ملف · 8 ملفات كحد أقصى</small>
        <button className="button button--secondary" onClick={() => inputRef.current?.click()} type="button">
          اختيار الملفات
        </button>
      </section>

      {files.length > 0 ? (
        <div className="upload-preview-grid" aria-label="الملفات المختارة">
          {previews.map(({ file, url }, index) => (
            <article className="upload-preview" key={`${file.name}-${file.lastModified}`}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`معاينة ${file.name}`} src={url} />
              ) : (
                <div className="upload-preview__pdf">PDF</div>
              )}
              <div>
                <strong>{file.name}</strong>
                <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
              </div>
              <button aria-label={`حذف ${file.name}`} className="plain-button plain-button--danger" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">حذف</button>
            </article>
          ))}
        </div>
      ) : null}

      <section className="workspace-panel custom-design-fields">
        <div className="workspace-panel__heading"><div><p className="eyebrow">تفاصيل الطلب</p><h2>ساعدنا على فهم التصميم</h2></div></div>
        <div className="workflow-form">
          <label className="workflow-form__full">اسم التصميم<input name="title" placeholder="مثال: خزانة غرفة نوم" required minLength={2} /></label>
          <label>نوع الأثاث<input name="furnitureType" placeholder="خزانة، طاولة، كنبة..." required /></label>
          <label>الكمية<input defaultValue="1" min="1" name="quantity" type="number" /></label>
          <label>العرض (سم)<input inputMode="decimal" name="width" /></label>
          <label>الارتفاع (سم)<input inputMode="decimal" name="height" /></label>
          <label>العمق (سم)<input inputMode="decimal" name="depth" /></label>
          <label>الخامة المفضلة<input name="material" /></label>
          <label>اللون<input name="color" /></label>
          <label>الميزانية التقريبية<input inputMode="decimal" name="budget" /></label>
          <label>الموعد المطلوب<input name="desiredDate" type="date" /></label>
          <label className="workflow-form__full">ملاحظات<textarea name="notes" placeholder="أضف أي تفاصيل تساعد المدير على تقييم إمكانية التنفيذ." rows={4} /></label>
        </div>
      </section>

      {error ? <div className="toast toast--error" role="alert">{error}</div> : null}
      {busy ? <div className="upload-progress" role="status"><span style={{ width: `${progress}%` }} /><strong>جاري رفع التصميم... {progress}%</strong></div> : null}
      <button className="button custom-design-submit" disabled={busy || files.length === 0} type="submit">
        {busy ? 'جاري إرسال التصميم...' : 'إرسال التصميم للمراجعة'}
      </button>
    </form>
  );
}
