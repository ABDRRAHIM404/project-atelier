export default function Loading() {
  return (
    <main aria-busy="true" className="app-loading-screen" id="main-content" tabIndex={-1}>
      <div className="app-loading-screen__content" role="status">
        <span className="app-loading-screen__spinner" aria-hidden="true" />
        <span>جاري فتح الصفحة...</span>
      </div>
    </main>
  );
}
