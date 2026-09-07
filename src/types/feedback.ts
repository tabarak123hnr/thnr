export type FeedbackStatus = "new" | "reviewed" | "archived";

export type FeedbackCategory =
  | "hotel"
  | "restaurant"
  | "staff"
  | "cleanliness"
  | "other";

export interface GuestFeedback {
  id: string;
  guestName: string;
  phone: string;
  email: string;
  roomNumber: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "hotel",
  "restaurant",
  "staff",
  "cleanliness",
  "other",
];
