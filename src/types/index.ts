export interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  likes: number;
  commentsCount: number;
  date: string;
}

export interface Metric {
  label: string;
  value: string | number;
  change: number;
}

export interface AnalyticsData {
  date: string;
  followers: number;
  reach: number;
  engagement: number;
}

export interface Message {
  id: string;
  sender: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread?: boolean;
}
