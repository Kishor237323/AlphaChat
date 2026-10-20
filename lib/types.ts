export type Profile = {
  id: string;
  username: string;
  last_seen: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  /** local only: being sent right now */
  pending?: boolean;
  /** local only: the insert failed, tap to retry */
  failed?: boolean;
};