import { useEffect, useMemo, useState } from "react";
import { fetchAppConfig } from "./api/client";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { DocumentationPage } from "./pages/DocumentationPage";
import { DrilldownPage } from "./pages/DrilldownPage";
import { InterviewPage } from "./pages/InterviewPage";
import type { AppConfig } from "./types";
import "./App.css";

const fallbackConfig: AppConfig = {
  appName: "",
  version: "Integrated Pipeline v2.0",
  productOptions: [
    "Intensive",
    "Academy",
    "External",
    "Academy Edge",
    "Nxtwave Edge",
    "NIAT",
    "Intensive Offline",
    "Experienced Hiring",
  ],
  pages: ["Interview analyser", "Drilldown", "Assessments", "Assignments"],
  interviewModules: ["Interview_analyser", "Video_uploader"],
};

export default function App() {
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const isDocumentationRoute =
    normalizedPath === "/documentation" || window.location.hash === "#/documentation";

  const [config, setConfig] = useState<AppConfig>(fallbackConfig);
  const [selectedProduct, setSelectedProduct] = useState<string>(fallbackConfig.productOptions[0]);
  const [selectedPage, setSelectedPage] = useState<string>(fallbackConfig.pages[0]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    if (isDocumentationRoute) {
      return;
    }

    const loadConfig = async (): Promise<void> => {
      try {
        setLoadingConfig(true);
        const remoteConfig = await fetchAppConfig();
        setConfig(remoteConfig);
        setSelectedProduct((prev) => (remoteConfig.productOptions.includes(prev) ? prev : remoteConfig.productOptions[0]));
        setSelectedPage((prev) => (remoteConfig.pages.includes(prev) ? prev : remoteConfig.pages[0]));
      } catch {
        setConfig(fallbackConfig);
      } finally {
        setLoadingConfig(false);
      }
    };

    void loadConfig();
  }, [isDocumentationRoute]);

  const pageContent = useMemo(() => {
    if (selectedPage === "Drilldown") {
      return <DrilldownPage product={selectedProduct} />;
    }

    if (selectedPage === "Assessments") {
      return <AssessmentsPage product={selectedProduct} />;
    }

    if (selectedPage === "Assignments") {
      return <AssignmentsPage product={selectedProduct} />;
    }

    return <InterviewPage product={selectedProduct} modules={config.interviewModules} />;
  }, [config.interviewModules, selectedPage, selectedProduct]);

  if (isDocumentationRoute) {
    return <DocumentationPage />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Psm Analyser Tool</h1>

        <label className="sidebar-label" htmlFor="product-select">
          Product
        </label>
        <select
          id="product-select"
          className="sidebar-select"
          value={selectedProduct}
          onChange={(event) => setSelectedProduct(event.target.value)}
        >
          {config.productOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <hr className="sidebar-divider" />

        <div className="nav-buttons">
          {config.pages.map((page) => (
            <button
              key={page}
              className={selectedPage === page ? "nav-button active" : "nav-button"}
              onClick={() => setSelectedPage(page)}
            >
              {page}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <a
            className="doc-link-button"
            href="/#/documentation"
            target="_blank"
            rel="noreferrer noopener"
          >
            Documentation
          </a>
          <div className="sidebar-footer">{config.version}</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2>{config.appName}</h2>
            <p>
              Page: <strong>{selectedPage}</strong> | Product: <strong>{selectedProduct}</strong>
            </p>
          </div>
          {loadingConfig && <div className="loading-chip">Loading config...</div>}
        </header>

        {pageContent}
      </main>
    </div>
  );
}
