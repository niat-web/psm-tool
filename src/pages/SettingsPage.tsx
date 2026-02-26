import { useEffect, useState } from "react";
import { fetchProviderSettings, saveProviderSettings } from "../api/client";
import type { ProviderSettings, ProviderSettingsEntry } from "../types";

const defaultEntry = (entry: Partial<ProviderSettingsEntry> = {}): ProviderSettingsEntry => ({
  apiKey: entry.apiKey ?? "",
  chatEndpoint: entry.chatEndpoint ?? "",
  ocrEndpoint: entry.ocrEndpoint ?? "",
  transcribeEndpoint: entry.transcribeEndpoint ?? "",
  chatModel: entry.chatModel ?? "",
  ocrModel: entry.ocrModel ?? "",
  transcribeModel: entry.transcribeModel ?? "",
});

const defaultSettings: ProviderSettings = {
  mistral: defaultEntry({
    chatEndpoint: "https://api.mistral.ai/v1/chat/completions",
    ocrEndpoint: "https://api.mistral.ai/v1/ocr",
    transcribeEndpoint: "https://api.mistral.ai/v1/audio/transcriptions",
    chatModel: "mistral-large-latest",
    ocrModel: "mistral-ocr-latest",
    transcribeModel: "voxtral-mini-latest",
  }),
  openai: defaultEntry({
    chatEndpoint: "https://api.openai.com/v1/chat/completions",
    ocrEndpoint: "https://api.openai.com/v1/chat/completions",
    transcribeEndpoint: "https://api.openai.com/v1/audio/transcriptions",
    chatModel: "gpt-4.1-mini",
    ocrModel: "gpt-4.1-mini",
    transcribeModel: "gpt-4o-mini-transcribe",
  }),
  updatedAt: "",
};

type ProviderKey = "mistral" | "openai";

export function SettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const remote = await fetchProviderSettings();
        setSettings(remote);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateField = (
    provider: ProviderKey,
    field: keyof ProviderSettingsEntry,
    value: string,
  ): void => {
    setSettings((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const save = async (): Promise<void> => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const saved = await saveProviderSettings(settings);
      setSettings(saved);
      setSuccess("Settings saved.");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const renderProviderCard = (provider: ProviderKey, title: string) => {
    const entry = settings[provider];
    return (
      <section className="provider-card">
        <h4>{title}</h4>
        <label>
          API Key
          <input
            type="text"
            value={entry.apiKey}
            onChange={(event) => updateField(provider, "apiKey", event.target.value)}
          />
        </label>
        <label>
          Chat Endpoint
          <input
            type="text"
            value={entry.chatEndpoint}
            onChange={(event) => updateField(provider, "chatEndpoint", event.target.value)}
          />
        </label>
        <label>
          OCR Endpoint
          <input
            type="text"
            value={entry.ocrEndpoint}
            onChange={(event) => updateField(provider, "ocrEndpoint", event.target.value)}
          />
        </label>
        <label>
          Transcribe Endpoint
          <input
            type="text"
            value={entry.transcribeEndpoint}
            onChange={(event) => updateField(provider, "transcribeEndpoint", event.target.value)}
          />
        </label>
        <label>
          Chat Model
          <input
            type="text"
            value={entry.chatModel}
            onChange={(event) => updateField(provider, "chatModel", event.target.value)}
          />
        </label>
        <label>
          OCR Model
          <input
            type="text"
            value={entry.ocrModel}
            onChange={(event) => updateField(provider, "ocrModel", event.target.value)}
          />
        </label>
        <label>
          Transcribe Model
          <input
            type="text"
            value={entry.transcribeModel}
            onChange={(event) => updateField(provider, "transcribeModel", event.target.value)}
          />
        </label>
      </section>
    );
  };

  return (
    <div className="page-section">
      <section className="panel">
        <h3>Settings</h3>
        <p className="muted">
          Configure global AI provider credentials and endpoints for all users.
        </p>
        <div className="settings-grid">
          {renderProviderCard("mistral", "Mistral")}
          {renderProviderCard("openai", "OpenAI")}
        </div>

        <div className="button-row">
          <button className="primary-button" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {loading && <span className="muted">Loading settings...</span>}
          {settings.updatedAt && !loading && (
            <span className="muted">Last updated: {new Date(settings.updatedAt).toLocaleString()}</span>
          )}
        </div>

        {success && <div className="live-status-line">{success}</div>}
        {error && <div className="error-box">{error}</div>}
      </section>
    </div>
  );
}
