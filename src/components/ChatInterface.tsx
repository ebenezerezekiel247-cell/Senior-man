import { Send, Sparkles, User, BrainCircuit, Trash2, Mic, MicOff, Copy, Check, Volume2, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getNaijaAIResponse } from "../services/gemini";
import { soundService } from "../services/sound";
import type { Message, ImageAttachment, ChatSession } from "../types";
import ImageUploader from "./ImageUploader";

interface Props {
  activeSession: ChatSession;
  onUpdateSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onError?: (msg: string) => void;
}

// Support for Web Speech API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// Loading phrases sub-component
function LoadingPhrases() {
  const [index, setIndex] = useState(0);
  const phrases = [
    "Senior Man de reason your matter...",
    "Hold tight, brain de cook better answer...",
    "Small small, water go full pot...",
    "I de find the correct sense for you...",
    "Patience na the senior brother of sense...",
    "Answer de come, make we calm down...",
    "Brain de bubble, results go soon show...",
    "No be speed, na accuracy we de find...",
    "Sense de load, hold your minerals..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [phrases.length]);

  return (
    <motion.p
      key={index}
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 5 }}
      className="text-[10px] font-bold text-naija-green/60 uppercase tracking-widest italic"
    >
      {phrases[index]}
    </motion.p>
  );
}

export default function ChatInterface({ activeSession, onUpdateSession, onDeleteSession, onError }: Props) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageAttachment | null>(null);
  const [displayMessages, setDisplayMessages] = useState<Message[]>(activeSession.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopy = (id: string, text: string) => {
    soundService.playClick();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string) => {
    soundService.playClick();
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.includes("en-GB")) || voices.find(v => v.lang.includes("en-US"));
      if (preferredVoice) utterance.voice = preferredVoice;
      
      utterance.pitch = 0.9;
      utterance.rate = 0.95;

      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = (e) => {
        console.error(e);
        setSpeakingId(null);
        if (onError) onError("Voice machine don enter voice-less mode. Abeg check your browser talk-talk settings! 🔇");
      };

      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setSpeakingId(null);
      if (onError) onError("Voice machine don enterv voice-less mode. Abeg check your browser talk-talk settings! 🔇");
    }
  };

  // Sync with parent session changes (e.g. session switch)
  useEffect(() => {
    setDisplayMessages(activeSession.messages);
  }, [activeSession.id, activeSession.messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, isLoading]);

  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-NG"; // Focus on Nigerian English/Pidgin context

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? " " : "") + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (onError) {
          if (event.error === "not-allowed") {
            onError("Abeg, give me power to hear you first (Mic permission)! 🎤❌");
          } else {
            onError("Something de do your mic, I no fit hear word! 🎤😅");
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onError]);

  const toggleListening = () => {
    soundService.playClick();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    soundService.playWhoosh();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input,
      image: selectedImage
        ? { url: selectedImage.url, mimeType: selectedImage.mimeType }
        : null,
      timestamp: Date.now(),
    };

    const updatedMessages = [...activeSession.messages, userMessage];
    setDisplayMessages([...displayMessages, userMessage]);
    
    // Auto-title if it's the first real user message
    let newTitle = activeSession.title;
    if (activeSession.title === "New Gist" && input.trim()) {
      newTitle = input.slice(0, 30) + (input.length > 30 ? "..." : "");
    }

    onUpdateSession({
      ...activeSession,
      title: newTitle,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    setInput("");
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: "ai",
      text: "",
      timestamp: Date.now(),
    };
    
    const finalMessages = [...updatedMessages, aiMessage];
    setDisplayMessages([...displayMessages, userMessage, aiMessage]);
    
    // Final sync for initial AI message (empty)
    onUpdateSession({
      ...activeSession,
      messages: finalMessages,
      updatedAt: Date.now(),
    });

    try {
      const stream = await getNaijaAIResponse(
        userMessage.text || "Scan dis image for me",
        currentImage ? { data: currentImage.data, mimeType: currentImage.mimeType } : null
      );

      soundService.playDing();
      let fullText = "";
      let lastUpdate = Date.now();
      
      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
          
          // Immediate UI update
          setDisplayMessages((prev) => 
            prev.map(m => m.id === aiMessageId ? { ...m, text: fullText } : m)
          );

          // Throttled persistence update (every 1.5s is safer for Firestore during streaming)
          const now = Date.now();
          if (now - lastUpdate > 1500) {
            const streamingMessages = finalMessages.map((m) =>
              m.id === aiMessageId ? { ...m, text: fullText } : m
            );
            onUpdateSession({
              ...activeSession,
              messages: streamingMessages,
              updatedAt: now,
            });
            lastUpdate = now;
          }
        }
      }

      // Final persistence update to ensure everything is synced
      const finalAiMessages = finalMessages.map((m) =>
        m.id === aiMessageId ? { ...m, text: fullText } : m
      );
      onUpdateSession({
        ...activeSession,
        messages: finalAiMessages,
        updatedAt: Date.now(),
      });
    } catch (error: any) {
      console.error("Error calling Gemini:", error);
      
      let errorMsg = "Omo, something don scatter for my side small. Abeg try again later! 😅";
      
      if (error?.message?.includes("quota")) {
        errorMsg = "Abeg no vex, I don talk too much for today! My brain don full (Quota exceeded). Let's wait small or try tomorrow! 🧠🔋";
      } else if (error?.message?.includes("network")) {
        errorMsg = "Your network de do like say e de dance Azonto! Check your connection biko. 📶💃";
      }
      
      const errorMessages = finalMessages.map((m) =>
        m.id === aiMessageId ? { ...m, text: errorMsg } : m
      );
      
      onUpdateSession({
        ...activeSession,
        messages: errorMessages,
        updatedAt: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-[2.5rem] overflow-hidden border border-white/5">
      <div className="bg-white/5 backdrop-blur-md p-6 flex items-center justify-between text-white border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="bg-naija-green p-2.5 rounded-xl accent-glow transform rotate-3">
            <BrainCircuit className="text-black" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tighter uppercase italic">Senior Man</h1>
            <p className="text-[10px] text-naija-green uppercase font-black tracking-widest flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-naija-green rounded-full animate-pulse accent-glow"></span>
              {activeSession.title}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              soundService.playClick();
              onDeleteSession(activeSession.id);
            }}
            className="glass p-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-white/10 transition-all"
            title="Delete chat"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => soundService.playClick()}
            className="bg-naija-green text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-widest accent-glow hover:scale-105 transition-transform hidden md:block"
          >
            Go Pro
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence initial={false}>
          {displayMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-4 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "ai" && (
                <div className="w-10 h-10 bg-naija-green rounded-xl flex items-center justify-center shrink-0 accent-glow">
                   <Sparkles className="text-black" size={20} />
                </div>
              )}
              
              <div className={`max-w-[75%] ${message.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`px-5 py-4 rounded-2xl shadow-xl relative group ${
                    message.role === "user"
                      ? "bg-white/10 border border-white/10 text-white rounded-tr-none"
                      : "glass-dark text-gray-100 rounded-tl-none border border-white/5"
                  }`}
                >
                  {message.role === "ai" && message.text && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleSpeak(message.id, message.text)}
                        className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all ${speakingId === message.id ? "text-naija-green" : "text-white/20 hover:text-naija-green"}`}
                        title={speakingId === message.id ? "Stop reading" : "Read aloud"}
                      >
                        {speakingId === message.id ? <Square size={14} fill="currentColor" /> : <Volume2 size={14} />}
                      </button>
                      <button
                        onClick={() => handleCopy(message.id, message.text)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/20 hover:text-naija-green transition-all"
                        title="Copy response"
                      >
                        {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  )}
                  {message.image && (
                    <div className="p-1 glass rounded-xl mb-4 inline-block max-w-full">
                      <div className="relative">
                        <img
                          src={message.image.url}
                          alt="User attachment"
                          className="w-full max-w-xs h-auto rounded-lg shadow-2xl border border-white/10"
                        />
                        <div className="absolute top-2 right-2 bg-naija-green text-black text-[9px] font-black px-2 py-1 rounded-md uppercase accent-glow">SCANNED</div>
                      </div>
                    </div>
                  )}
                  <div className={`markdown-body text-sm md:text-base ${message.role === "ai" ? "italic text-green-50" : ""}`}>
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                    {message.role === "ai" && message.text === "" && (
                      <div className="py-2 flex flex-col gap-3">
                        <div className="flex gap-1.5 items-center">
                          <div className="w-2 h-2 bg-naija-green rounded-full animate-bounce accent-glow"></div>
                          <div className="w-2 h-2 bg-naija-green rounded-full animate-bounce [animation-delay:0.2s] accent-glow"></div>
                          <div className="w-2 h-2 bg-naija-green rounded-full animate-bounce [animation-delay:0.4s] accent-glow"></div>
                        </div>
                        <AnimatePresence mode="wait">
                          <LoadingPhrases />
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[9px] uppercase font-black mt-2 opacity-30 px-2 tracking-widest">
                  {message.role === "user" ? "Paddie Mi" : "Senior Man Boss"}
                </div>
              </div>

              {message.role === "user" && (
                <div className="w-10 h-10 glass rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                   <User className="text-white/60" size={20} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-8 bg-black/20 border-t border-white/5">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-4">
          <ImageUploader onImageSelect={setSelectedImage} onError={onError} />
          
          <div className="flex-1 relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Listening... Speak now 👂" : "Ask me anything for Pidgin..."}
                className={`w-full h-14 pl-6 pr-14 py-4 glass rounded-2xl focus:outline-none focus:ring-1 focus:ring-naija-green focus:border-transparent transition-all resize-none max-h-32 text-white placeholder:text-white/20 text-sm ${isListening ? "ring-2 ring-red-500 animate-pulse-soft" : ""}`}
                id="chat-input"
              />
              <div className="absolute right-14 top-4.5 hidden md:block">
                 <div className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/30 uppercase font-black tracking-tighter">
                   {isListening ? "Listening" : "Active"}
                 </div>
              </div>
              <button
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className={`absolute right-2 bottom-2 p-3 rounded-xl transition-all ${
                  (!input.trim() && !selectedImage) || isLoading
                    ? "bg-white/5 text-white/20"
                    : "bg-naija-green text-black hover:bg-green-400 accent-glow transform hover:scale-105"
                }`}
              >
                <Send size={20} className="transform rotate-0" />
              </button>
            </div>

            {SpeechRecognition && (
              <button
                type="button"
                onClick={toggleListening}
                className={`h-14 w-14 glass rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                  isListening ? "bg-red-500/20 text-red-500 border-red-500/50 accent-glow" : "text-white/40 hover:text-naija-green hover:bg-white/10"
                }`}
                title={isListening ? "Stop listening" : "Speak your message"}
              >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
