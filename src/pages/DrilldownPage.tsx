import { useRef, useState } from "react";
import { cancelJob, getDrilldownSampleTemplateUrl, startDrilldownJob } from "../api/client";
import { ResultTable } from "../components/ResultTable";
import { downloadCsv, rowsToCsv } from "../utils/csv";
import {
  notifyJobCompleted,
  notifyJobFailed,
  requestDesktopNotificationPermission,
} from "../utils/desktopNotifications";
import {
  isJobCancelledByUserError,
  isPollingAbortedError,
  waitForJobCompletion,
} from "../utils/jobPolling";
import { parseCsvRows } from "../utils/parsers";
import type { ApiResult } from "../types";

export function DrilldownPage({ product }: { product: string }) {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const handleCsvUpload = async (file: File): Promise<void> => {
    const text = await file.text();
    const parsed = parseCsvRows(text);
    setRows(parsed);
    setResult(null);
    setError(parsed.length === 0 ? "CSV is empty or invalid." : null);
  };

  const start = async (): Promise<void> => {
    void requestDesktopNotificationPermission();
    const pollController = new AbortController();
    pollAbortRef.current = pollController;

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setLiveStatus("Submitting drilldown job...");
      const started = await startDrilldownJob(rows, product);
      setActiveJobId(started.jobId);
      const response = await waitForJobCompletion(
        started.jobId,
        (status) => {
          setLiveStatus(status.message);
        },
        1200,
        { signal: pollController.signal },
      );
      setResult(response);
      setLiveStatus("Completed.");
      void notifyJobCompleted({
        jobName: "Drilldown Analysis",
        rowsCount: response.rows.length,
        savedToSheet: response.savedToSheet,
      });
    } catch (err) {
      if (isPollingAbortedError(err)) {
        return;
      }
      if (isJobCancelledByUserError(err)) {
        setLiveStatus("Stopped by user.");
        return;
      }
      void notifyJobFailed({ jobName: "Drilldown Analysis", errorMessage: String(err) });
      setError(String(err));
    } finally {
      setLoading(false);
      setActiveJobId(null);
      pollAbortRef.current = null;
    }
  };

  const stop = async (): Promise<void> => {
    if (!loading || !activeJobId) return;
    if (!window.confirm("Are you sure you want to stop?")) {
      return;
    }

    try {
      setLiveStatus("Stopping...");
      await cancelJob(activeJobId);
      pollAbortRef.current?.abort();
      setActiveJobId(null);
      setLoading(false);
      setLiveStatus("Stopped by user.");
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="page-section">
      <section className="panel">
        <h3>Drilldown</h3>
        <a className="link-button" href={getDrilldownSampleTemplateUrl()} target="_blank" rel="noreferrer">
          Download Sample Template
        </a>

        <label className="file-input">
          Upload Drilldown CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleCsvUpload(file);
              }
            }}
          />
        </label>

        <div className="muted">Loaded candidate rows: {rows.length}</div>
        {rows.length > 0 && <ResultTable rows={rows.slice(0, 10)} maxHeight={280} />}

        <div className="button-row">
          <button className="primary-button" onClick={start} disabled={loading || rows.length === 0}>
            {loading ? "Running Drilldown Analysis..." : "Start Live Analysis"}
          </button>
          {loading && (
            <button className="danger-button" onClick={() => void stop()}>
              Stop
            </button>
          )}
        </div>
        {(loading || liveStatus) && <div className="live-status-line">{liveStatus || "Starting..."}</div>}

        {error && <div className="error-box">{error}</div>}

        {result && (
          <>
            <div className="status-row">
              <span>Extracted rows: {result.rows.length}</span>
              <span>Saved to sheet: {result.savedToSheet ? "Yes" : "No"}</span>
            </div>
            <button
              className="secondary-button"
              onClick={() => downloadCsv("drilldown_analysis.csv", rowsToCsv(result.rows))}
            >
              Download Final CSV
            </button>
            <ResultTable rows={result.rows} />
          </>
        )}
      </section>
    </div>
  );
}
