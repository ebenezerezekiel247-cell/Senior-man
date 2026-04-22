import { Plus, MessageSquare, History, User as UserIcon } from "lucide-react";
import type { ChatSession } from "../types";
import type { User } from "firebase/auth";
import { soundService } from "../services/sound";

interface Props {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  user: User | null;
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewChat, user }: Props) {
  return (
    <aside className="w-72 glass rounded-[2.5rem] p-6 flex flex-col h-full border border-white/5">
      <div 
        className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" 
        onClick={() => {
          soundService.playClick();
          onNewChat();
        }}
      >
        <div className="w-10 h-10 bg-naija-green rounded-xl flex items-center justify-center font-bold text-black accent-glow transform group-hover:rotate-6 transition-transform">
          <Plus size={24} />
        </div>
        <h1 className="text-xl font-black tracking-tighter uppercase italic">New Chat</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-black mb-4 px-2">
          <History size={12} /> Recent Chats
        </div>
        
        {sessions.length === 0 && (
          <div className="text-xs text-white/20 italic px-2">No past gists yet...</div>
        )}

        {sessions.sort((a, b) => b.updatedAt - a.updatedAt).map((session) => (
          <button
            key={session.id}
            onClick={() => {
              soundService.playClick();
              onSelectSession(session.id);
            }}
            className={`w-full text-left p-4 rounded-2xl text-sm transition-all border flex items-center gap-3 group translate-z-0 ${
              activeSessionId === session.id
                ? "bg-white/10 border-white/20 shadow-lg"
                : "border-transparent hover:bg-white/5 text-white/60"
            }`}
          >
            <MessageSquare size={16} className={activeSessionId === session.id ? "text-naija-green" : "text-white/20"} />
            <span className="truncate flex-1 font-medium tracking-tight">
              {session.title || "New Gist"}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-8">
        <div className="glass-dark p-4 rounded-2xl flex items-center gap-3 border border-white/10">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User profile" className="w-10 h-10 rounded-xl shadow-lg border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
               <UserIcon size={20} className="text-white" />
            </div>
          )}
          <div className="flex-1 truncate">
            <div className="text-xs font-black uppercase tracking-tight truncate">
              {user ? (user.displayName || user.email?.split('@')[0]) : "Senior Man"}
            </div>
            <div className="text-[10px] text-white/40 uppercase font-bold">
              {user ? "Cloud Gist Active" : "Local History Only"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
