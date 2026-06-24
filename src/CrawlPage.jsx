import { useState, useEffect } from "react";
import CrawledUrls from "./CrawledUrls";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CrawlPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [crawledDataSource, setCrawledDataSource] = useState(null);

  const [stats, setStats] = useState({
    totalSources: 0,
    trained: 0,
    untrained: 0,
    lastCrawl: null
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/data-sources`);
      const d = await res.json();
      if (d.success && d.dataSources) {
        const sources = d.dataSources;
        let trainedSources = 0;
        sources.forEach(s => {
          if (s.trained_pages > 0) {
            trainedSources++;
          }
        });

        setStats({
          totalSources: sources.length,
          trained: trainedSources,
          untrained: sources.length - trainedSources,
          lastCrawl: sources.length > 0 ? sources[0] : null
        });
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const parseSafeDate = (dateString) => {
    if (!dateString) return null;
    let ds = dateString;
    if (!ds.endsWith('Z') && !ds.includes('+', 10) && ds.lastIndexOf('-') < 10) {
      ds += 'Z';
    }
    const date = new Date(ds);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatIST = (dateString) => {
    const date = parseSafeDate(dateString);
    if (!date) return "Nil";
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
  };

  const getRelativeTime = (dateString) => {
    const date = parseSafeDate(dateString);
    if (!date) return "Nil";
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatName = (name, url) => {
    if (name && name.toLowerCase() !== "null" && name !== url) return name;
    if (!url) return "Unknown";
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      let hostname = parsed.hostname.replace(/^www\./, '');
      const lastDot = hostname.lastIndexOf('.');
      if (lastDot !== -1) hostname = hostname.substring(0, lastDot);
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      return url;
    }
  };

  const pollCrawlStatus = (id, websiteUrl) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/crawl-status/${id}`);
        const statusData = await res.json();

        if (statusData.status === "completed") {
          clearInterval(interval);
          setLoading(false);
          setSuccessMessage("");
          setCrawledDataSource({ id: id, url: websiteUrl, name: websiteUrl });
          fetchStats();
        } else if (statusData.status === "failed") {
          clearInterval(interval);
          setErrorMessage("Crawling failed: " + statusData.error);
          setLoading(false);
        } else if (statusData.status === "crawling") {
          setSuccessMessage(statusData.urls_found ? `Crawling in progress... Found ${statusData.urls_found} URLs so far.` : "Crawling in progress...");
        }
      } catch (e) {
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!url) return;
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    setCrawledDataSource(null);
    try {
      const res = await fetch(`${API}/add-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json();
      if (d.success) {
        setSuccessMessage("Crawling website...");
        pollCrawlStatus(d.id, d.url);
      } else {
        setErrorMessage(d.error || "Failed to add website");
        setLoading(false);
      }
    } catch {
      setErrorMessage("Could not connect to server");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden bg-[#0a0a0f] text-slate-200 font-sans relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-6xl mx-auto pt-10 px-6 z-10 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/[0.02] border border-white/5 rounded-[20px] p-6 backdrop-blur-xl shadow-lg hover:border-white/10 transition-colors">
            <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              Data Sources
            </h2>
            <div className="text-4xl font-bold text-white tracking-tight mb-5">{stats.totalSources}</div>

            <div className="flex flex-col gap-2.5 mb-1">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                <span className="text-emerald-400 font-bold text-sm">{stats.trained}</span>
                <span className="text-slate-500 text-sm">trained</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                <span className="text-rose-400 font-bold text-sm">{stats.untrained}</span>
                <span className="text-slate-500 text-sm">untrained</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 pt-4 border-t border-white/5 mt-4">Current indexed vs pending knowledge sources</p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[20px] p-6 backdrop-blur-xl shadow-lg hover:border-white/10 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  Last Crawl
                </h2>
                {stats.lastCrawl && stats.lastCrawl.status !== 'failed' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {stats.lastCrawl.status === 'crawling' ? 'Crawling' : 'Done'}
                  </span>
                )}
                {stats.lastCrawl && stats.lastCrawl.status === 'failed' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Failed
                  </span>
                )}
              </div>
              <div className="text-xl font-semibold text-white tracking-tight mb-2 truncate" title={stats.lastCrawl?.name || "No domains indexed yet"}>
                {stats.lastCrawl ? formatName(stats.lastCrawl.name, stats.lastCrawl.url) : "No domains indexed"}
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">{stats.lastCrawl?.total_pages || 0}</span>
                  <span className="text-xs text-slate-500">Pages</span>
                </div>
                <div className="w-px bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm">{stats.lastCrawl?.trained_pages || 0}</span>
                  <span className="text-xs text-slate-500">Trained</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[20px] p-6 backdrop-blur-xl shadow-lg hover:border-white/10 transition-colors flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Last Crawl Time
              </h2>
              <div className="text-4xl font-bold text-white tracking-tight mb-2">
                {getRelativeTime(stats.lastCrawl?.created_at)}
              </div>
              <div className="text-sm text-slate-400 cursor-help hover:text-slate-300 transition-colors inline-block" title="Exact timestamp of the last crawl operation in IST">
                {formatIST(stats.lastCrawl?.created_at)}
              </div>
            </div>
            <p className="text-xs text-slate-500 pt-3 border-t border-white/5">Auto-updating metrics</p>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex items-center justify-center w-full px-6 z-10 transition-all duration-500 ${crawledDataSource ? 'mt-10 py-10' : '-mt-10'}`}>
        <div className="w-full max-w-[700px] flex flex-col items-center text-center">
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">Index a new website</h1>
          <p className="text-slate-400 text-sm mb-8 max-w-md leading-relaxed">Enter a website to crawl.</p>

          <div className="w-full relative group">
            <div className="relative bg-[#0d0d12] border border-white/10 rounded-[18px] p-1.5 backdrop-blur-xl flex gap-2 items-center shadow-2xl">
              <div className="pl-4 text-slate-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input type="text" value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={loading}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-600 py-3 px-2 text-base w-full focus:ring-0"
              />
              <button
                onClick={handleSubmit}
                disabled={!url || loading}
                className="px-6 py-3.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:bg-white/5 border border-transparent disabled:border-white/5 transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[140px]"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Crawling...
                  </>
                ) : (
                  <>
                    Start Crawl
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="h-10 mt-6 flex items-center justify-center">
            {successMessage && (
              <div className="text-emerald-400 text-sm font-medium flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="text-rose-400 text-sm font-medium flex items-center gap-2 px-4 py-2 bg-rose-500/10 rounded-full border border-rose-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {crawledDataSource && (
        <div className="w-full mt-auto border-t border-white/5 bg-black/20 pt-8 pb-10 px-6">
          <div className="max-w-6xl mx-auto">
            <CrawledUrls dataSource={crawledDataSource} />
          </div>
        </div>
      )}
    </main>
  );
}
