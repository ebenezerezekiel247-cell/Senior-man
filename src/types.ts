export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  image?: {
    url: string;
    mimeType: string;
  } | null;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface ImageAttachment {
  data: string; // base64
  url: string;
  mimeType: string;
}
