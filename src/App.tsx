import { useEffect, useState } from "react";
import type { ConstellationData } from "./lib/types";
import { loadConstellationData } from "./lib/loadData";
import { Constellation } from "./components/Constellation";

// Vite serves /public at the app base, so this resolves correctly under
// both user pages and project pages thanks to import.meta.env.BASE_URL.
const DATA_URL = `${import.meta.env.BASE_URL}data/contributions.json`;

export default function App() {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConstellationData(DATA_URL)
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">Commit Constellation</h1>
        <p className="app-sub">
          {data
            ? `${data.user} · ${data.totalContributions.toLocaleString()} contributions in the last year`
            : "把你的 GitHub 貢獻畫成一片星空"}
          {data?.isMock && <span className="app-badge">範例資料</span>}
        </p>
      </header>

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
