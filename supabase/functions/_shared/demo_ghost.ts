type AnswerOption = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "medium" | "hard";

interface DemoQuestionRow {
  sequence: number;
  question: {
    correct_answer: AnswerOption;
    difficulty: Difficulty;
  };
}

function nextWrongAnswer(correctAnswer: AnswerOption): AnswerOption {
  const options: AnswerOption[] = ["A", "B", "C", "D"];
  const index = options.indexOf(correctAnswer);
  return options[(index + 1) % options.length];
}

export function buildDemoGhostPayload(
  questions: DemoQuestionRow[],
  penaltyFactor: number,
) {
  let cumulativeScore = 0;

  const frames = questions.map((row) => {
    const difficultyOffset =
      row.question.difficulty === "hard" ? 1400 : row.question.difficulty === "medium" ? 900 : 500;
    const answerOffsetMs = Math.min(9200, 1600 + row.sequence * 470 + difficultyOffset);
    const isCorrect = ![3, 6].includes(row.sequence);
    const selectedAnswer = isCorrect ? row.question.correct_answer : nextWrongAnswer(row.question.correct_answer);
    const awardedScore = isCorrect ? Math.max(0, Math.floor(1000 - answerOffsetMs * penaltyFactor)) : 0;
    cumulativeScore += awardedScore;

    return {
      questionSequence: row.sequence,
      answerOffsetMs,
      selectedAnswer,
      awardedScore,
      cumulativeScore,
    };
  });

  return {
    profile: {
      userId: null,
      username: "Echo Rival",
      avatar: null,
      level: 12,
      xp: 4800,
      isGhost: true,
    },
    frames,
    totalScore: cumulativeScore,
  };
}
