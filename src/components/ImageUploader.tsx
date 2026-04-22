import { Camera, Image as ImageIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { soundService } from "../services/sound";
import type { ImageAttachment } from "../types";

interface Props {
  onImageSelect: (image: ImageAttachment | null) => void;
  onError?: (message: string) => void;
}

export default function ImageUploader({ onImageSelect, onError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        onError?.("Abeg, this your picture too heavy (Max 5MB)! Find one wey small small. 🖼️⚖️");
        clearImage();
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = (reader.result as string).split(",")[1];
          const url = reader.result as string;
          const attachment = {
            data: base64String,
            url: url,
            mimeType: file.type,
          };
          setPreview(url);
          onImageSelect(attachment);
        } catch (err) {
          onError?.("Omo, this picture de give me headache to load. Abeg try another one! 🤕");
          clearImage();
        }
      };
      reader.onerror = () => {
        onError?.("Omo, this picture de give me headache to load. Abeg try another one! 🤕");
        clearImage();
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    soundService.playClick();
    setPreview(null);
    onImageSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-full mb-4 left-0"
          >
            <div className="relative group">
              <img
                src={preview}
                alt="Upload preview"
                className="w-32 h-32 object-cover rounded-xl border-4 border-white shadow-lg"
              />
              <button
                onClick={clearImage}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            soundService.playClick();
            fileInputRef.current?.click();
          }}
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all group shrink-0"
          title="Upload image"
          id="upload-button"
        >
          <ImageIcon className="text-white/60 group-hover:text-naija-green transition-colors" size={24} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            soundService.playClick();
            if (fileInputRef.current) {
              fileInputRef.current.setAttribute("capture", "environment");
              fileInputRef.current.click();
            }
          }}
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all group md:hidden shrink-0"
          title="Take photo"
          id="camera-button"
        >
          <Camera className="text-white/60 group-hover:text-naija-green transition-colors" size={24} />
        </button>
      </div>
    </div>
  );
}
