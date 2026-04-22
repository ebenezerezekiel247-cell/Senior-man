import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, X, Info } from "lucide-react";
import { useEffect } from "react";

export type NotificationType = "error" | "info" | "success";

interface Props {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

export default function Notification({ message, type, onClose, duration = 5000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = {
    error: "border-red-500/50 bg-red-500/10 text-red-400",
    info: "border-blue-500/50 bg-blue-500/10 text-blue-400",
    success: "border-naija-green/50 bg-naija-green/10 text-naija-green",
  };

  const icons = {
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
    success: <Info size={18} />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`fixed bottom-24 right-8 z-50 glass p-4 rounded-2xl border flex items-center gap-3 shadow-2xl min-w-[300px] max-w-md ${colors[type]}`}
    >
      <div className="shrink-0">{icons[type]}</div>
      <p className="text-sm font-medium leading-tight flex-1">{message}</p>
      <button 
        onClick={onClose}
        className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
      >
        <X size={18} />
      </button>
    </motion.div>
  );
}
