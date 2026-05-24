// src/screens/ForceUpdate.jsx — Non-dismissable update screen
// Shown when appControl returns { status: 'update_required' }.
// No close button. No Escape key. User must update.

export default function ForceUpdate({
  message,
  updateUrl,
  currentVersion,
  requiredVersion,
}) {
  const handleDownload = () => {
    if (updateUrl) {
      window.antonAPI.openExternal(updateUrl);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border p-12 text-center dark:border-slate-700 dark:bg-slate-800 border-slate-200 bg-white shadow-xl">
        {/* Icon */}
        <div className="mb-6 text-4xl">🚀</div>

        {/* Heading */}
        <h1 className="text-2xl font-bold dark:text-slate-100 text-slate-900">
          Update Required
        </h1>

        {/* Message from Firestore */}
        <p className="mt-2 text-sm dark:text-slate-400 text-slate-500">
          {message || 'A new version of Anton AI is available.'}
        </p>

        {/* Divider */}
        <div className="mx-auto my-6 h-px w-4/5 dark:bg-slate-700 bg-slate-200" />

        {/* Preservation assurances */}
        <div className="space-y-3 text-left">
          <CheckRow text="Your AI models are safe — they stay on your PC" />
          <CheckRow text="Your chat history is fully preserved" />
          <CheckRow text="Your settings are saved" />
        </div>

        {/* Divider */}
        <div className="mx-auto my-6 h-px w-4/5 dark:bg-slate-700 bg-slate-200" />

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          <WindowsIcon />
          Download Update — Microsoft Store
        </button>

        {/* Version info */}
        <p className="mt-4 text-xs dark:text-slate-500 text-slate-400">
          Current: v{currentVersion || '?.?.?'}
          {'  ·  '}
          Required: v{requiredVersion || '?.?.?'}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckRow({ text }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full dark:bg-emerald-900/40 bg-emerald-50">
        <svg
          className="h-3.5 w-3.5 dark:text-emerald-400 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="dark:text-slate-300 text-slate-600">{text}</span>
    </div>
  );
}

function WindowsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}
