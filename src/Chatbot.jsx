import { useState, useRef, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function extractStoreName(url) {
  if (!url) return "Store";
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const name = host.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Store";
  }
}

export default function Chatbot({ store, branding, onClose }) {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm your shopping assistant. Show me any product and I'll help you find it!", type: "text" }
  ]);
  const [input, setInput] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [inputMode, setInputMode] = useState("text");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastProduct, setLastProduct] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const videoRef = useRef(null);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const recRef = useRef(null);
  const botTextRef = useRef("");

  const handleClose = () => {
    window.speechSynthesis.cancel();
    stopListening();
    if (wsRef.current) wsRef.current.close();
    clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onClose();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      recRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  function addMsg(role, text, type = "text", data = null) {
    setMessages(prev => [...prev, { role, text, type, data }]);
  }

  function removeThinking() {
    setMessages(prev => prev.filter(m => m.type !== "thinking"));
  }

  function speak(text) {
    if (inputMode !== "voice") return;
    window.speechSynthesis.cancel();
    botTextRef.current = text;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";

    utter.onstart = () => {
      setIsSpeaking(true);
      setMessages(prev => {
        const lastBotIndex = [...prev].reverse().findIndex(m => m.role === "bot");
        if (lastBotIndex !== -1) {
          setSpeakingIndex(prev.length - 1 - lastBotIndex);
        }
        return prev;
      });
    };

    utter.onend = () => {
      setIsSpeaking(false);
      setSpeakingIndex(-1);
    };

    utter.onerror = () => {
      setIsSpeaking(false);
      setSpeakingIndex(-1);
    };

    window.speechSynthesis.speak(utter);
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    console.log("sendmessage:", text);
    setInput("");
    addMsg("user", text);
    addMsg("bot", "Thinking...", "thinking");
    setIsProcessing(true);

    try {
      const history = messages
        .filter(m => m.type !== "thinking")
        .concat({ role: "user", text })
        .map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, from_user: true, website_url: store?.url, website_id: store?.id })
      });

      const { reply, open_camera, find_products } = await res.json();
      console.log("chat reply:", reply, " open_camera:", open_camera, " find_products:", find_products);
      setIsProcessing(false);
      removeThinking();
      addMsg("bot", reply);
      speak(reply);

      if (open_camera && !cameraOn)
        openCamera();
      if (find_products) {
        let query = text;
        if (lastProduct && text.length < 100) {
          query = `${text} ${lastProduct}`;
        } else if (!text && lastProduct) {
          query = lastProduct;
        }
        fetchProducts(query);
      }
    } catch (err) {
      console.error("sendmessage error:", err);
      setIsProcessing(false);
      removeThinking();
      addMsg("bot", "Connection error. Please try again.");
    }
  }

  async function sendCameraResult(description, imageUrl = null) {
    console.log("sendcam", description);
    setLastProduct(description);
    addMsg("user", description, "text", imageUrl ? { imageUrl } : null);
    addMsg("bot", "Thinking...", "thinking");
    setIsProcessing(true);

    try {
      const history = messages
        .filter(m => m.type !== "thinking")
        .concat({ role: "user", text: description })
        .map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, from_user: false, website_url: store?.url, website_id: store?.id })
      });

      const { reply, find_products } = await res.json();
      console.log("camera chat reply:", reply, " find_products:", find_products);
      setIsProcessing(false);
      removeThinking();
      addMsg("bot", reply);
      speak(reply);

      if (find_products) fetchProducts(description);
    } catch (err) {
      console.error("sendcam error:", err);
      setIsProcessing(false);
      removeThinking();
      addMsg("bot", "Connection error. Please try again.");
    }
  }

  async function fetchProducts(description) {
    console.log("fetchproducts called with:", { description, websiteUrl: store?.url });
    addMsg("bot", "Searching for products...", "thinking");
    setIsProcessing(true);
    try {
      console.log("Sending POST request to /products...");
      const res = await fetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, website_url: store?.url })
      });
      const data = await res.json();
      console.log("products response received:", data);
      setIsProcessing(false);
      removeThinking();
      const productMsg = data.message || "Here are some similar products:";
      addMsg("bot", productMsg, "products", data.products);
      speak(productMsg);
    } catch (err) {
      console.error("fetchproducts error:", err);
      setIsProcessing(false);
      removeThinking();
      addMsg("bot", "Couldn't fetch products right now.");
    }
  }

  function openCamera() {
    console.log("opening camera...");
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws");
    wsRef.current = ws;
    let done = false;

    ws.onopen = async () => {
      console.log("websocket connected");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("camera stream acquired");
        streamRef.current = stream;
        setCameraOn(true);

        intervalRef.current = setInterval(() => {
          if (done || !videoRef.current || ws.readyState !== WebSocket.OPEN) return;
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 640;
          canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
          console.log("sending frame to server...");
          ws.send(canvas.toDataURL("image/jpeg").split(",")[1]);
        }, 5000);
      } catch {
        console.error("camera access denied");
        addMsg("bot", "Could not access camera. Please allow camera permissions.");
        ws.close();
      }
    };

    ws.onmessage = (e) => {
      if (done) return;
      const desc = e.data;
      console.log("ws message from server:", desc);
      if (desc && desc.toLowerCase() !== "no product detected") {
        console.log("product detected:", desc);
        done = true;
        let capturedImage = null;
        if (videoRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 640;
          canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
          capturedImage = canvas.toDataURL("image/jpeg");
        }
        stopCamera();
        setTimeout(() => sendCameraResult(desc, capturedImage), 400);
      }
    };

    ws.onclose = () => console.log("websocket closed");
    ws.onerror = (err) => {
      console.error("websocket error:", err);
      addMsg("bot", "Camera connection error.");
    };
  }

  function stopCamera() {
    console.log("stopping camera");
    clearInterval(intervalRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  useEffect(() => {
    let shouldListen = inputMode === "voice" && isVoiceActive && !isProcessing;
    
    if (shouldListen && !listening) {
      startListening();
    } else if (!shouldListen && listening) {
      stopListening();
    }
  }, [inputMode, isVoiceActive, isProcessing, listening]);

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMsg("bot", "Voice input not supported. Try Chrome.");
      return;
    }
    if (listening || recRef.current) return;
    console.log("starting voice recognition");

    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      console.log("voice started");
      setListening(true);
      setTranscript("");
    };
    rec.onend = () => {
      console.log("voice ended");
      setListening(false);
      recRef.current = null;
      setTranscript("");
    };
    rec.onerror = (e) => {
      console.error("voice error:", e.error);
      setListening(false);
      recRef.current = null;
      setTranscript("");
      if (e.error !== "no-speech" && e.error !== "aborted")
        addMsg("bot", `Voice error: ${e.error}`);
    };
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      
      const currentTranscript = final || interim;
      console.log("voice interim:", interim, "| final:", final);

      if (isSpeaking && currentTranscript.trim().length > 0) {
        const normTranscript = currentTranscript.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        const normBot = botTextRef.current.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        
        const transcriptWords = normTranscript.split(/\s+/).filter(w => w.length > 0);
        const botWords = normBot.split(/\s+/).filter(w => w.length > 0);
        
        let matchCount = 0;
        transcriptWords.forEach(w => {
           if (botWords.includes(w)) matchCount++;
        });
        
        // If more than 50% of the recognized words are found in the bot's response, it's an echo from laptop speakers
        if (transcriptWords.length > 0 && (matchCount / transcriptWords.length) > 0.5) {
           console.log("Ignoring speaker echo:", currentTranscript);
           return;
        }

        // Genuine interruption
        console.log("User interrupted bot with:", currentTranscript);
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      setTranscript(currentTranscript);

      if (final && !isSpeaking) {
        setListening(false);
        recRef.current = null;
        setTranscript("");
        sendMessage(final.trim());
      } else if (final) {
        // If it's final but we were speaking (and didn't interrupt), ignore it
        setTranscript("");
      }
    };

    try {
      rec.start();
    } catch (e) {
      console.error("Error starting recognition", e);
      recRef.current = null;
    }
  }

  function stopListening() {
    console.log("stopping voice recognition");
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition", e);
      }
      recRef.current = null;
    }
    setListening(false);
    setTranscript("");
  }

  function renderProducts(products) {
    if (!products?.length) return null;
    return (
      <div className="flex flex-col gap-3 mt-2 w-full max-w-2xl">
        {products.map((p, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex gap-4 w-full">
            {p.image_url && p.image_url !== "https://example.com/image.jpg" && p.image_url !== "" ? (
              <div className="w-28 h-28 shrink-0">
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg bg-gray-50 border border-gray-100" />
              </div>
            ) : (
              <div className="w-28 h-28 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                <span className="text-gray-400 text-xs">No image</span>
              </div>
            )}
            <div className="flex flex-col flex-1 py-1 min-w-0">
              <p className="text-gray-900 font-semibold text-base line-clamp-1">{p.name}</p>
              <p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{p.match}</p>
              
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="font-semibold text-gray-900 truncate pr-2">{p.price}</span>
                {p.product_url && p.product_url !== "https://example.com/product" && p.product_url !== "" && (
                  <a href={p.product_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1 whitespace-nowrap shrink-0" style={{ color: "var(--brand-color, #2563eb)" }}>
                    See Details
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderMessage(msg, i) {
    if (msg.type === "thinking") {
      return (
        <div key={i} className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-1" style={{ backgroundColor: "var(--brand-color, #111827)" }}>AI</div>
          <div className="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl text-sm italic flex items-center gap-2">
            {msg.text}
            <span className="flex gap-1">
              {[0, 1, 2].map(d => (
                <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </span>
          </div>
        </div>
      );
    }

    if (msg.type === "products") {
      return (
        <div key={i} className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-1" style={{ backgroundColor: "var(--brand-color, #111827)" }}>AI</div>
          <div className="max-w-[85%]">
            <div className="bg-gray-100 text-gray-800 px-4 py-2.5 rounded-2xl text-sm mb-2 transition-all duration-200" style={speakingIndex === i ? { outline: "2px solid var(--brand-color, #111827)", outlineOffset: "2px" } : {}}>{msg.text}</div>
            {renderProducts(msg.data)}
          </div>
        </div>
      );
    }

    return (
      <div key={i} className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
        {msg.role === "bot" && (
          <div className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-1 ${speakingIndex === i ? "animate-pulse" : ""}`} style={{ backgroundColor: "var(--brand-color, #111827)" }}>AI</div>
        )}
        <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
          {msg.data?.imageUrl && (
            <img src={msg.data.imageUrl} alt="Captured product" className="w-48 h-48 object-cover rounded-xl shadow-sm border border-gray-200" />
          )}
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed transition-all duration-200 ${msg.role === "user" ? "text-white" : "bg-gray-100 text-gray-800"}`}
               style={{
                 ...(msg.role === "user" ? { backgroundColor: "var(--brand-color, #111827)" } : {}),
                 ...(speakingIndex === i && msg.role === "bot" ? { outline: "2px solid var(--brand-color, #111827)", outlineOffset: "2px" } : {})
               }}>
            {msg.text}
            {speakingIndex === i && msg.role === "bot" && (
              <span className="ml-2 inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: "0.3s" }} />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <div className="flex items-center gap-3 px-4 py-3 shadow-sm border-b border-transparent" style={{ backgroundColor: "var(--brand-color, #1e1e24)", color: "#ffffff" }}>
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
          <img src={`https://www.google.com/s2/favicons?domain=${store?.url}&sz=64`} alt="" className="w-6 h-6 object-contain" onError={e => { e.target.style.display='none'; }}/>
        </div>

        <div>
          <p className="text-white font-semibold text-sm">{branding?.company_name || extractStoreName(store?.url)} Bot</p>
        </div>

        {/* Close button */}
        {onClose && (
          <button onClick={handleClose} className="ml-auto text-white/80 hover:text-white text-lg leading-none transition-colors">
            ✕
          </button>
        )}

        {/* Text / Voice toggle */}
        <div className={`flex gap-1 bg-black/20 rounded-lg p-0.5 ${!onClose ? 'ml-auto' : 'ml-2'}`}>
          <button
            onClick={() => { setInputMode('text'); setIsVoiceActive(false); stopListening(); window.speechSynthesis.cancel(); }}
            className={`text-xs px-3 py-1 rounded-md transition-all ${
              inputMode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >Text</button>
          <button
            onClick={() => { setInputMode('voice'); setIsVoiceActive(true); window.speechSynthesis.cancel(); }}
            className={`text-xs px-3 py-1 rounded-md transition-all ${
              inputMode === 'voice' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >Voice</button>
        </div>

        {cameraOn && (
          <button onClick={() => { stopCamera(); addMsg("bot", "Camera stopped."); }} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 ml-2">
            Stop Camera
          </button>
        )}
      </div>

      {cameraOn && (
        <div className="px-5 pt-4 flex justify-center">
          <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-square max-w-sm rounded-xl object-cover border border-gray-200" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-white">
        {messages.map((msg, i) => renderMessage(msg, i))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-200 bg-white flex gap-3">
        {inputMode === "text" ? (
          <>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} placeholder="Ask anything or say 'show a product'..." className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-gray-800 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-gray-400" />
            <button onClick={() => sendMessage(input)} className="text-white text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--brand-color, #111827)" }}>
              Send</button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1 w-full">
            <div className="w-full min-h-[28px] flex items-center justify-center">
              {isProcessing && <p className="text-sm text-brand-color font-medium animate-pulse">Processing...</p>}
              {!isProcessing && isSpeaking && <p className="text-sm text-brand-color font-medium">Bot is speaking... (Speak to interrupt)</p>}
              {!isProcessing && !isSpeaking && listening && transcript && <p className="text-sm text-gray-600 italic">&ldquo;{transcript}&rdquo;</p>}
              {!isProcessing && !isSpeaking && listening && !transcript && <p className="text-xs text-gray-400">Listening...</p>}
              {!isProcessing && !isSpeaking && !listening && !isVoiceActive && <p className="text-xs text-gray-400">Voice mode paused</p>}
            </div>

            <button 
              onClick={() => {
                if (isSpeaking) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                } else {
                  setIsVoiceActive(!isVoiceActive);
                }
              }} 
              className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${listening ? "bg-red-500 scale-110" : isVoiceActive ? "bg-gray-400" : "hover:opacity-90"}`} 
              style={(!listening && !isVoiceActive) || (!listening && isSpeaking) ? { backgroundColor: "var(--brand-color, #111827)" } : {}}
            >
              {listening && !isProcessing && !isSpeaking && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white relative z-10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 9a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V19h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A7 7 0 0 1 5 10z" />
              </svg>
            </button>
            <p className="text-xs text-gray-400">
              {isSpeaking ? "Tap to interrupt" : isVoiceActive ? "Tap to pause" : "Tap to resume"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
