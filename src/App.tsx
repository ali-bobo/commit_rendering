import { useEffect, useState } from "react";
import type { ConstellationData, YearIndex } from "./lib/types";
import { loadConstellationData, loadYearIndex } from "./lib/loadData";
import { Constellation } from "./components/Constellation";

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [index, setIndex] = useState<YearIndex | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<ConstellationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the year index on mount.
  useEffect(() => {
    loadYearIndex(`${BASE}data/index.json`)
      .then((idx) => {
        setIndex(idx);
        setYear(idx.years[0]); // default: most recent year
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, []);

  // Load the selected year's data whenever the year changes.
  useEffect(() => {
    if (!year) return;
    setData(null);
    loadConstellationData(`${BASE}data/contributions-${year}.json`)
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, [year]);

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Commit Constellation</h1>
        <p className="app-sub">
          {data
            ? `${data.user} · ${data.totalContributions.toLocaleString()} contributions in ${year}`
            : "把你的 GitHub 貢獻畫成一片星空"}
          {data?.isMock && <span className="app-badge">範例資料</span>}
        </p>
      </header>

      {index && index.years.length > 1 && (
        <nav className="app-years" aria-label="年份選擇">
          {index.years.map((y) => (
            <button
              key={y}
              className={`app-year-btn${y === year ? " active" : ""}`}
              onClick={() => {
                setYear(y);
                setError(null);
              }}
              aria-pressed={y === year}
            >
              {y}
            </button>
          ))}
        </nav>
      )}

      {error && (
        <div className="app-error">
          無法載入資料：{error}
          <br />
          先執行 <code>npm run fetch:mock</code> 產生範例資料。
        </div>
      )}

      {!error && !data && <div className="app-loading">載入星空中…</div>}

      {data && <Constellation data={data} />}

      <footer className="app-footer">
        {data && (
          <span>
            更新於 {new Date(data.generatedAt).toLocaleString()} ·{" "}
            {data.isMock ? "範例資料" : "GitHub 即時資料"}
          </span>
        )}
      </footer>
    </main>
  );
}
