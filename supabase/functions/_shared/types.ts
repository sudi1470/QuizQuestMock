export type MatchType = "live_random" | "async_random" | "friend_challenge";
export type MatchState = "waiting" | "ready" | "question_active" | "interstitial" | "results" | "complete";
export type AnswerOption = "A" | "B" | "C" | "D";

export interface QueueJoinBody {
  categoryId: string;
  matchType: MatchType;
  friendId?: string | null;
}

export interface MatchReadyBody {
  matchId: string;
}

export interface SubmitAnswerBody {
  matchId: string;
  questionSequence: number;
  selectedAnswer?: AnswerOption | null;
  responseTimeMs: number;
}

export interface SyncMatchStateBody {
  matchId: string;
}
