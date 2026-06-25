import { useState, useEffect } from "react";

const API = (import.meta.env.VITE_API_URL || "https://web-production-f4e3d.up.railway.app").replace(/\/+$/, "");

export default function CrawledUrls({ dataSource, onBack }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trainingState, setTrainingState] = useState("");

  const fetchPages = async () => {
    try {
      const res = await fetch(`${API}/data-sources/${dataSource.id}/pages`);
      const d = await res.json();
      if (d.success) setPages(d.pages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkTrainingStatus = async () => {
    try {
      const res = await fetch(`${API}/training-status/?url=${encodeURIComponent(dataSource.url)}`);
      const d = await res.json();
      if (d.status === "training") {
        setTrainingState("training");
        setTimeout(checkTrainingStatus, 3000);
      } else if (d.status === "completed") {
        setTrainingState("completed");
        fetchPages();
      } else if (d.status === "failed") {
        setTrainingState("failed");
      }
    } catch (e) { }
  };

  useEffect(() => {
    if (dataSource) {
      fetchPages();
      checkTrainingStatus();
    }
  }, [dataSource]);

  const toggleTraining = async (id) => {
    try {
      await fetch(`${API}/pages/${id}/training`, { method: "PUT" });
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, selected_for_training: !p.selected_for_training } : p))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectAll = async (select) => {
    try {
      await fetch(`${API}/data-sources/${dataSource.id}/pages/select-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ select })
      });
      fetchPages();
    } catch (e) {
      console.error(e);
    }
  };

  const deletePage = async (id) => {
    if (!window.confirm("Delete this page?")) return;
    try {
      await fetch(`${API}/pages/${id}`, { method: "DELETE" });
      setPages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const startTraining = async () => {
    try {
      setTrainingState("training");
      await fetch(`${API}/data-sources/${dataSource.id}/train`, { method: "POST" });
      setTimeout(checkTrainingStatus, 2000);
    } catch (err) {
      console.error(err);
      setTrainingState("failed");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto w-full">
      <div className="max-w-4xl mx-auto w-full">
        {onBack && (
          <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-2">
            Back to Data Sources
          </button>
        )}

        <div className="flex items-center justify-between mb-8"><div>
          <h1 className="text-2xl font-bold text-white">{dataSource.name}</h1>
          <p className="text-slate-400 text-sm">{dataSource.url}</p>
        </div>
          <div className="flex items-center gap-4">
            {trainingState === "training" && <span className="text-indigo-400 text-sm animate-pulse">Training...</span>}
            {trainingState === "completed" && <span className="text-emerald-400 text-sm">Training Done</span>}
            {trainingState === "failed" && <span className="text-rose-400 text-sm">Training Failed</span>}

            <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10">
              <button onClick={() => handleSelectAll(true)} className="px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors border-r border-white/5">Select All
              </button>
              <button onClick={() => handleSelectAll(false)} className="px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                Deselect
              </button>
            </div>

            <button onClick={startTraining} disabled={trainingState === "training"} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 disabled:text-slate-500 rounded-lg text-sm font-medium text-white transition-colors">
              Start Training</button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="text-slate-500">Loading URLs</div>
          ) : pages.length === 0 ? (
            <div className="text-slate-500">No crawled URLs found for this data source.</div>
          ) : (
            pages.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                <div className="flex flex-col truncate pr-4">
                  <span className="text-slate-200 text-sm truncate" title={p.page_url}>{p.page_url}</span>
                  <div className="flex gap-3 mt-1"><span className={`text-[10px] uppercase font-bold tracking-wider ${p.selected_for_training ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {p.selected_for_training ? 'Selected' : 'Unselected'}
                  </span><span className={`text-[10px] uppercase font-bold tracking-wider ${p.trained ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {p.trained ? 'Trained' : 'Untrained'}
                    </span></div></div>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-white">
                    <input type="checkbox" checked={p.selected_for_training} onChange={() => toggleTraining(p.id)} disabled={p.trained} className="accent-indigo-500 w-4 h-4 rounded" />Train
                  </label><button onClick={() => deletePage(p.id)} className="text-rose-500 hover:text-rose-400 text-xs px-2 py-1 bg-rose-500/10 rounded">
                    Delete</button></div></div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
