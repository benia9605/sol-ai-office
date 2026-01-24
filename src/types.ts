export interface Room {
  id: string;
  name: string;
  emoji: string;
  aiName: string;
  aiModel: string;
  role: string;
  personality: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export interface ChatHistory {
  id: string;
  roomId: string;
  roomName: string;
  roomEmoji: string;
  lastMessage: string;
  timestamp: Date;
}
