import { useState } from "react";
import CrawlPage from "./CrawlPage";
import Chatbot from "./Chatbot";
import DataSources from "./DataSources";
import CrawledUrls from "./CrawledUrls";

const navItems = [
  { id: "crawl", label: "Crawl", icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg> },
  { id: "sources", label: "Data Sources", icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> }
];

export default function App() {
  const [active, setActive] = useState("crawl");
  const [selectedDataSource, setSelectedDataSource] = useState(null);

  const navigateToCrawl = () => setActive("crawl");

  const navigateToUrls = (dataSource) => {
    setSelectedDataSource(dataSource);
    setActive("urls");
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-slate-200 overflow-hidden font-sans">
    <aside className="w-[180px] border-r border-white/5 flex flex-col shrink-0">
    <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
    <span className="font-semibold text-white text-[15px]">Multimodal bot</span> </div>
    <nav className="p-3 space-y-1">{navItems.map(({ id, label, icon }) => {const isActive = active === id || (active === "urls" && id === "sources");
      return (
        <button key={id} onClick={() => setActive(id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${ isActive? "bg-indigo-500/10 text-white border border-indigo-500/40": "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"}`}>{icon}{label}
  </button>);})}</nav>
</aside>
{active === "crawl" && <CrawlPage />} 
{active === "sources" && <DataSources onAddStore={navigateToCrawl} onSelect={navigateToUrls} />}
{active === "urls" && <CrawledUrls dataSource={selectedDataSource} onBack={() => setActive("sources")} />}
</div>);}