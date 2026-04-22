/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import ChatInterface from "./components/ChatInterface";
import Sidebar from "./components/Sidebar";
import Notification, { NotificationType } from "./components/Notification";
import type { ChatSession, Message } from "./types";
import { auth, signInWithGoogle, logout, db } from "./services/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  getDocs 
} from "firebase/firestore";
import { LogIn, LogOut, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { soundService } from "./services/sound";

const STORAGE_KEY = "seniorman_sessions";
const SOUND_KEY = "seniorman_sound_enabled";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "ai",
  text: "How far! Wetin de sup? Oya, welcome to **Senior Man**. I be your smart neighbor wey sabi everything. \n\nIf you get any homework wey de give you wahala, snap am upload for here – or just gist with me for Pidgin. I de ground for you life and direct! 🇳🇬👊",
  timestamp: Date.now(),
};

function createNewSession(userId?: string): ChatSession {
  return {
    id: Date.now().toString(),
    title: "New Gist",
    messages: [WELCOME_MESSAGE],
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(SOUND_KEY);
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    soundService.setEnabled(soundEnabled);
    localStorage.setItem(SOUND_KEY, soundEnabled.toString());
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      // Small feedback when turning on
      soundService.setEnabled(true);
      soundService.playClick();
    }
  };

  const showError = (msg: string) => setNotification({ message: msg, type: "error" });
  const showInfo = (msg: string) => setNotification({ message: msg, type: "info" });
  const showSuccess = (msg: string) => setNotification({ message: msg, type: "success" });

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      showSuccess("Oga boss, you don enter! Welcome back. 😎");
    } catch (e: any) {
      showError("Omo, Google sign-in don get small wahala. Abeg try again! 😅");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showInfo("You don go? No wahala, see you next time paddie! 👋");
    } catch (e: any) {
      showError("Even to sign out be wahala? Abeg try again. 😂");
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Loading (Local or Firebase)
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      // Load from LocalStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) setActiveSessionId(parsed[0].id);
      } else {
        const newSession = createNewSession();
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
      }
      return;
    }

    // Load from Firestore
    const sessionsRef = collection(db, "users", user.uid, "sessions");
    const q = query(sessionsRef, orderBy("updatedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const sessionList: ChatSession[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          updatedAt: data.updatedAt,
          messages: [] // We'll load these separately for the active session
        };
      });

      setSessions((prev) => {
        // Merge with existing messages if we have them
        return sessionList.map(s => {
          const existing = prev.find(p => p.id === s.id);
          return existing ? { ...s, messages: existing.messages } : s;
        });
      });

      if (sessionList.length === 0) {
        const newSession = createNewSession(user.uid);
        await saveSessionToFirestore(user.uid, newSession);
      } else {
        if (!activeSessionId || !sessionList.find(s => s.id === activeSessionId)) {
          setActiveSessionId(sessionList[0].id);
        }
      }
    });

    return unsubscribe;
  }, [user, isAuthLoading]);

  // Load messages for active session
  useEffect(() => {
    if (!user || !activeSessionId) return;

    const messagesRef = collection(db, "users", user.uid, "sessions", activeSessionId, "messages");
    const mq = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(mq, (snapshot) => {
      const messages = snapshot.docs.map(d => d.data() as Message);
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: messages.length > 0 ? messages : [WELCOME_MESSAGE] } 
          : s
      ));
    });

    return unsubscribe;
  }, [user, activeSessionId]);

  const saveSessionToFirestore = async (uid: string, session: ChatSession) => {
    try {
      const sessionRef = doc(db, "users", uid, "sessions", session.id);
      await setDoc(sessionRef, {
        id: session.id,
        userId: uid,
        title: session.title,
        updatedAt: session.updatedAt,
        createdAt: session.id
      }, { merge: true });

      const messagesRef = collection(db, "users", uid, "sessions", session.id, "messages");
      for (const msg of session.messages) {
        await setDoc(doc(messagesRef, msg.id), msg);
      }
    } catch (e) {
      console.error(e);
      showError("Cloud sync no gree work. Your gists safe for phone memory sha! ☁️❌");
    }
  };

  const handleUpdateSession = async (updated: ChatSession) => {
    // Local state update first for responsiveness
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      if (!user) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    if (!user) return;

    // Update Firestore (Session Metadata)
    const sessionRef = doc(db, "users", user.uid, "sessions", updated.id);
    await setDoc(sessionRef, {
      id: updated.id,
      userId: user.uid,
      title: updated.title,
      updatedAt: updated.updatedAt,
      createdAt: updated.id // Assuming ID is timestamp string
    }, { merge: true });

    // Save only the latest message to avoid heavy writes during streaming
    const lastMsg = updated.messages[updated.messages.length - 1];
    if (lastMsg) {
      const msgRef = doc(db, "users", user.uid, "sessions", updated.id, "messages", lastMsg.id);
      await setDoc(msgRef, lastMsg, { merge: true });
    }
  };

  const handleNewChat = async () => {
    const newSession = createNewSession(user?.uid);
    try {
      if (!user) {
        setSessions((prev) => {
          const next = [newSession, ...prev];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        setActiveSessionId(newSession.id);
      } else {
        await saveSessionToFirestore(user.uid, newSession);
        setActiveSessionId(newSession.id);
      }
    } catch (e) {
      showError("I no fit start new chat now. Abeg refresh! 🔄");
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      if (!user) {
        setSessions((prev) => {
          const filtered = prev.filter((s) => s.id !== id);
          if (id === activeSessionId) {
            if (filtered.length > 0) setActiveSessionId(filtered[0].id);
            else {
              const fresh = createNewSession();
              setActiveSessionId(fresh.id);
              localStorage.setItem(STORAGE_KEY, JSON.stringify([fresh]));
              return [fresh];
            }
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          return filtered;
        });
      } else {
        const sessionRef = doc(db, "users", user.uid, "sessions", id);
        await deleteDoc(sessionRef);
        showInfo("Gist don go. Empty pocket! 🗑️");
      }
    } catch (e) {
      showError("The chat stubborn, e no gree delete. Try again! 😂");
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white italic tracking-widest font-black uppercase">
        <div className="animate-pulse">Loading Senior Man...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-naija-green/30 selection:text-white relative overflow-hidden">
      {/* Immersive Radial Gradient Background */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top left, #052c1e 0%, #020617 100%)'
        }}
      ></div>

      {/* Atmospheric Blur Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] bg-naija-green/10 rounded-full blur-[160px]"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[140px]"></div>
      </div>

      <div className="fixed top-6 right-6 z-30 flex items-center gap-3">
        <button
          onClick={toggleSound}
          className="glass p-2.5 rounded-xl text-white/60 hover:text-white transition-all border border-white/10"
          title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        {user ? (
          <button 
            onClick={() => {
              soundService.playClick();
              handleLogout();
            }}
            className="glass px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-all border border-white/10"
          >
            <LogOut size={14} /> SIGN OUT
          </button>
        ) : (
          <button 
            onClick={() => {
              soundService.playClick();
              handleSignIn();
            }}
            className="bg-naija-green text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 accent-glow hover:scale-105 transition-all"
          >
            <LogIn size={14} /> SIGN IN WITH GOOGLE
          </button>
        )}
      </div>

      <AnimatePresence>
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </AnimatePresence>

      <main className="relative z-10 w-full h-screen p-4 md:p-6 lg:p-6 flex gap-6 mt-4">
        <div className="hidden lg:block h-full">
          <Sidebar 
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onNewChat={handleNewChat}
            user={user}
          />
        </div>
        
        <section className="flex-1 h-full min-w-0">
          {activeSession && (
            <ChatInterface 
              activeSession={activeSession}
              onUpdateSession={handleUpdateSession}
              onDeleteSession={handleDeleteSession}
              onError={showError}
            />
          )}
        </section>
      </main>

      <footer className="fixed bottom-6 right-28 z-20 hidden lg:block">
        <div className="flex items-center gap-3 glass px-4 py-2 rounded-full">
          <div className="w-2 h-2 bg-naija-green rounded-full animate-pulse accent-glow"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Senior Man • Powered by Gemini</span>
        </div>
      </footer>
    </div>
  );
}



