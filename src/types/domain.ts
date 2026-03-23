export type MatchType = "live_random" | "async_random" | "friend_challenge";
export type MatchMode = "live" | "ghost";
export type MatchState = "waiting" | "ready" | "question_active" | "interstitial" | "results" | "complete";
export type Difficulty = "easy" | "medium" | "hard";
export type AnswerOption = "A" | "B" | "C" | "D";
export type RatingScope = "global" | "category";
export type QueueStatus = "queued" | "matched" | "expired" | "cancelled";
export type MatchOutcome = "win" | "loss" | "draw" | "pending" | "abandoned";

export interface Profile {
  id: string;
  username: string;
  avatar: string | null;
  xp: number;
  level: number;
  globalRating: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface MatchSummary {
  id: string;
  categoryId: string;
  categoryName: string;
  matchType: MatchType;
  mode: MatchMode;
  state: MatchState;
  currentQuestion: number;
  totalQuestions: number;
  startedAt: string | null;
  questionStartedAt: string | null;
  expiresAt: string | null;
}

export interface MatchCompetitor {
  userId: string | null;
  username: string;
  avatar: string | null;
  level: number;
  xp: number;
  finalScore: number;
  isGhost: boolean;
  outcome: MatchOutcome;
}

export interface MatchQuestionView {
  id: string;
  sequence: number;
  prompt: string;
  difficulty: Difficulty;
  options: Record<AnswerOption, string>;
}

export interface AnswerSubmission {
  matchId: string;
  questionSequence: number;
  selectedAnswer?: AnswerOption | null;
  responseTimeMs: number;
  submittedAtClient: string;
}

export interface GhostPlaybackFrame {
  questionSequence: number;
  answerOffsetMs: number;
  selectedAnswer: AnswerOption | null;
  awardedScore: number;
  cumulativeScore: number;
}

export interface MatchResult {
  player: MatchCompetitor;
  opponent: MatchCompetitor;
  winnerUserId: string | null;
  isDraw: boolean;
  xpDelta: number;
  ratingDelta: number;
}

export interface RatingDelta {
  scope: RatingScope;
  categoryId?: string | null;
  previousRating: number;
  newRating: number;
  delta: number;
  provisional: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  rating: number;
  xp: number;
  categoryId?: string | null;
}

export interface NotificationItem {
  id: string;
  type: "async_turn_ready" | "friend_challenge" | "match_result" | "leaderboard_movement";
  title: string;
  body: string;
  payload: Record<string, string | number | boolean | null>;
  readAt: string | null;
  createdAt: string;
}

export interface RealtimeMatchEvent<TPayload = Record<string, unknown>> {
  type:
    | "match_found"
    | "player_ready"
    | "question_start"
    | "answer_submitted"
    | "score_update"
    | "match_end"
    | "rematch_requested";
  matchId: string;
  emittedAt: string;
  payload: TPayload;
}
