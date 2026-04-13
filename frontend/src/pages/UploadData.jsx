import { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';
import Button3D from '../components/Button3D';
import { useAuth } from '../context/AuthContext';
import {
  formatFirestoreError,
  saveManualRecord,
  subscribeToUploads,
  uploadFileAndIngest,
  validateUploadFile
} from '../services/salesDataService';

export default function UploadDataPage() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [manual, setManual] = useState({ productName: '', sales: '', stock: '', date: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationMessage, setValidationMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef(null);

  const hasManualError = useMemo(
    () =>
      !manual.productName.trim() ||
      manual.sales === '' ||
      manual.stock === '' ||
      Number(manual.sales) < 0 ||
      Number(manual.stock) < 0 ||
      !manual.date,
    [manual]
  );

  useEffect(() => {
    if (!user?.uid) {
      setHistory([]);
      return () => {};
    }

    const unsub = subscribeToUploads(
      user.uid,
      (rows) => setHistory(rows.slice(0, 8)),
      () => setHistory([])
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!toast) return () => {};
    const timer = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectFile = (selectedFile) => {
    const message = validateUploadFile(selectedFile);
    setValidationMessage(message);
    setFile(message ? null : selectedFile);
  };

  const handleFileUpload = async (event) => {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      if (!user?.uid) {
        throw new Error('Please sign in before uploading data.');
      }

      const result = await uploadFileAndIngest({
        userId: user.uid,
        file,
        onProgress: (percent) => setUploadProgress(percent)
      });

      setSuccess(
        result.warning
          ? `Data uploaded successfully. ${result.recordsCount} records integrated. ${result.warning}`
          : `Data uploaded successfully. ${result.recordsCount} records integrated.`
      );
      setToast('Data uploaded successfully');
      setFile(null);
      setValidationMessage('');
    } catch (err) {
      const message = formatFirestoreError(err, 'Failed to upload file');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!user?.uid) {
        throw new Error('Please sign in before submitting data.');
      }

      const result = await saveManualRecord({
        userId: user.uid,
        record: {
          productName: manual.productName,
          sales: Number(manual.sales),
          stock: Number(manual.stock),
          date: manual.date
        }
      });

      setSuccess(
        result?.warning ? `Manual record submitted successfully. ${result.warning}` : 'Manual record submitted successfully'
      );
      setToast('Manual entry saved');
      setManual({ productName: '', sales: '', stock: '', date: '' });
    } catch (err) {
      const message = formatFirestoreError(err, 'Failed to submit manual record');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Upload Business Data</h1>
        <p className="mt-1 text-sm text-slate-400">Add your sales and inventory data to generate insights</p>
      </div>

      <ErrorBanner message={error} />
      {success ? <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div> : null}
      {validationMessage ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">{validationMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={handleFileUpload} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 xl:col-span-2">
          <h2 className="text-lg font-medium text-white">Drag & Drop Upload (CSV/JSON/XLSX)</h2>
          <p className="mt-1 text-sm text-slate-400">Required fields: productName, sales, stock, date</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(event) => selectFile(event.target.files?.[0] || null)}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
              dragActive ? 'border-emerald-400 bg-emerald-400/10' : 'border-slate-600 bg-slate-950/40 hover:border-slate-500'
            }`}
          >
            <p className="text-sm text-slate-200">Drop your CSV, JSON, or XLSX file here or click to browse</p>
            <p className="mt-1 text-xs text-slate-400">{file ? `Selected: ${file.name}` : 'No file selected'}</p>
          </div>

          {loading ? (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Upload progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-emerald-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          <Button3D
            type="submit"
            color1="#16a34a"
            color2="#166534"
            disabled={loading || !file || Boolean(validationMessage)}
            className="mt-4"
          >
            {loading ? 'Uploading...' : 'Upload Data'}
          </Button3D>
        </form>

        <aside className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Recent Uploads History</h3>
          <div className="mt-3 space-y-3">
            {history.length ? (
              history.map((item, idx) => (
                <div key={`${item.createdAt}-${idx}`} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">{item.fileType === 'manual' ? 'Manual Entry' : 'File Upload'}</span>
                    <span
                      className={`text-xs ${
                        (item.status || 'success') === 'success'
                          ? 'text-emerald-300'
                          : (item.status || 'success') === 'partial'
                            ? 'text-amber-300'
                            : 'text-rose-300'
                      }`}
                    >
                      {item.status || 'success'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.fileName || 'Unknown source'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Pending timestamp'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No uploads yet.</p>
            )}
          </div>
        </aside>
      </div>

      <form onSubmit={handleManualSubmit} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <h2 className="text-lg font-medium text-white">Manual Entry Form</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              placeholder="Product Name"
              value={manual.productName}
              onChange={(event) => setManual((prev) => ({ ...prev, productName: event.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              required
            />
            <input
              type="number"
              min="0"
              placeholder="Sales"
              value={manual.sales}
              onChange={(event) => setManual((prev) => ({ ...prev, sales: event.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              required
            />
            <input
              type="number"
              min="0"
              placeholder="Stock"
              value={manual.stock}
              onChange={(event) => setManual((prev) => ({ ...prev, stock: event.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              required
            />
            <input
              type="date"
              value={manual.date}
              onChange={(event) => setManual((prev) => ({ ...prev, date: event.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              required
            />
        </div>

        <div className="mt-4">
          <Button3D type="submit" color1="#16a34a" color2="#166534" disabled={loading || hasManualError}>
            {loading ? 'Submitting...' : 'Submit'}
          </Button3D>
        </div>
      </form>

      {loading ? <Spinner label="Processing upload" /> : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 shadow-xl shadow-black/30">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
