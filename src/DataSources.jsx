import { useState, useEffect } from "react";
import Chatbot from "./Chatbot";

const API = "https://web-production-f4e3d.up.railway.app";

export default function DataSources({ onAddStore, onSelect }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);
  const [branding, setBranding] = useState(null);

  const fetchSources = async () => {
    try {
      const res = await fetch(`${API}/data-sources`);
      const d = await res.json();
      if (d.success) setSources(d.dataSources || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    const fetchBranding = async () => {
      try {
        const res = await fetch(`${API}/data-sources/${selectedStore.id}/branding`);
        const data = await res.json();
        if (data.success && data.branding && data.branding.primary_color) {
          setBranding(data.branding);
          document.documentElement.style.setProperty('--brand-color', data.branding.primary_color);
        } else {
          setBranding(null);
          document.documentElement.style.setProperty('--brand-color', '#6d28d9');
        }
      } catch (e) {
        console.error("Failed to fetch branding", e);
        setBranding(null);
        document.documentElement.style.setProperty('--brand-color', '#6d28d9');
      }
    };
    fetchBranding();
  }, [selectedStore]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this data source?")) return;
    try {
      await fetch(`${API}/data-sources/${id}`, { method: "DELETE" });
      if (selectedStore?.id === id) {
        setSelectedStore(null);
      }
      fetchSources();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`${API}/data-sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      setEditingId(null);
      fetchSources();
      if (selectedStore?.id === id) {
        setSelectedStore(prev => ({ ...prev, name: editName }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (e, source) => {
    e.stopPropagation();
    setEditingId(source.id);
    setEditName(source.name);
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0f] overflow-hidden">
      {/* Left panel — store list, always visible */}
      <div className={`flex flex-col border-r border-white/10 transition-all duration-200 shrink-0 h-full ${selectedStore ? 'w-[450px] min-w-[450px]' : 'flex-1'}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h1 className="text-xl font-bold text-white tracking-tight">Data Sources</h1>
          <button onClick={onAddStore} className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
            Add Store
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {loading ? (
            <div className="text-slate-500 text-sm p-2">Loading data sources...</div>
          ) : sources.length === 0 ? (
            <div className="text-slate-500 text-sm p-2">No data sources found. Add a website to start.</div>
          ) : (
            sources.map(store => {
              const selected = selectedStore?.id === store.id;
              return (
                <div
                  key={store.id}
                  className={`p-5 rounded-xl border transition-colors ${
                    selected
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Main Container switches layout based on selectedStore */}
                  <div className={`flex ${selectedStore ? 'flex-col' : 'flex-row items-center justify-between w-full gap-4'}`}>
                    
                    {/* Left Side: Info */}
                    <div className="flex flex-col min-w-0 flex-1">
                      {editingId === store.id ? (
                        <div className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-sm w-full max-w-xs"
                            autoFocus
                          />
                          <button onClick={(e) => handleSaveEdit(e, store.id)} className="text-emerald-400 text-xs hover:underline shrink-0">Save</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-slate-400 text-xs hover:underline shrink-0">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-lg font-semibold text-white truncate">{store.name}</p>
                      )}
                      <p className="text-slate-400 text-sm mt-0.5 truncate">{store.url}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-xs">{store.total_pages || 0} pages · Added {new Date(store.created_at).toLocaleDateString()}</p>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium border ${
                          store.total_pages > 0 && store.trained_pages === store.total_pages
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : store.trained_pages > 0
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {store.total_pages > 0 && store.trained_pages === store.total_pages ? 'Trained' : store.trained_pages > 0 ? 'Partially Trained' : 'Untrained'}
                        </span>
                      </div>
                    </div>

                    {/* Right Side: Buttons */}
                    <div className={`flex items-center gap-10 shrink-0 ${selectedStore ? 'mt-4' : 'mt-0'}`}>
                      <button onClick={(e) => startEdit(e, store)} className="px-3 py-1.5 rounded border border-white/10 text-white/50 hover:bg-white/5 text-xs transition-colors">Edit</button>
                      <button onClick={(e) => handleDelete(e, store.id)} className="px-3 py-1.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 text-xs transition-colors">Delete</button>
                      <button onClick={(e) => { e.stopPropagation(); onSelect(store); }} className="px-3 py-1.5 rounded border border-blue-400/30 text-blue-400 hover:bg-blue-400/10 text-xs transition-colors">URLs</button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (store.total_pages > 0 && store.trained_pages === store.total_pages) {
                            setSelectedStore(store);
                          }
                        }}
                        disabled={!(store.total_pages > 0 && store.trained_pages === store.total_pages)}
                        title={!(store.total_pages > 0 && store.trained_pages === store.total_pages) ? "Train the data source to enable chat" : ""}
                        className={`px-4 py-1.5 rounded border text-xs transition-colors ${
                          store.total_pages > 0 && store.trained_pages === store.total_pages
                            ? "bg-purple-400/10 border-purple-400/30 text-purple-400 hover:bg-purple-400/20 cursor-pointer"
                            : "bg-gray-500/10 border-gray-500/30 text-gray-500 cursor-not-allowed opacity-50"
                        }`}
                      >Chat</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — only renders when a store is selected via Chat button */}
      {selectedStore && (
        <div className="flex-1 flex flex-col bg-white h-full relative">
          <Chatbot store={selectedStore} branding={branding} key={selectedStore.id} onClose={() => setSelectedStore(null)} />
        </div>
      )}
    </div>
  );
}
