import { GamePattern, CardTemplate } from '../lib/supabase';

export const generateBingoCard = (cardId: number, numberRange: number): number[][] => {
  const ranges = getNumberRanges(numberRange);
  const card: number[][] = [];
  
  for (let row = 0; row < 5; row++) {
    const cardRow: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        cardRow.push(0); // Free space
      } else {
        const range = ranges[col];
        const num = range.min + ((cardId + row * 5 + col) % (range.max - range.min + 1));
        cardRow.push(num);
      }
    }
    card.push(cardRow);
  }
  
  return card;
};

export const getNumberRanges = (maxNumber: number) => {
  const rangeSize = Math.floor(maxNumber / 5);
  return [
    { min: 1, max: rangeSize, letter: 'B' },
    { min: rangeSize + 1, max: rangeSize * 2, letter: 'I' },
    { min: rangeSize * 2 + 1, max: rangeSize * 3, letter: 'N' },
    { min: rangeSize * 3 + 1, max: rangeSize * 4, letter: 'G' },
    { min: rangeSize * 4 + 1, max: maxNumber, letter: 'O' },
  ];
};

export const getNumberLetter = (number: number, numberRange: number): string => {
  const ranges = getNumberRanges(numberRange);
  for (const range of ranges) {
    if (number >= range.min && number <= range.max) {
      return range.letter;
    }
  }
  return 'X';
};

// Validate a card against a fixed pattern
export const validateBingo = (
  card: number[][],
  markedNumbers: number[],
  pattern: boolean[][]
): boolean => {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (pattern[row][col]) {
        const number = card[row][col];
        // Free space is always marked
        if (!(row === 2 && col === 2 && number === 0) && !markedNumbers.includes(number)) {
          return false;
        }
      }
    }
  }
  return true;
};

// Returns all completed rows, columns, diagonals
export const checkLinePatterns = (card: number[][], markedNumbers: number[]): string[] => {
  const winners: string[] = [];

  // Check rows
  for (let row = 0; row < 5; row++) {
    if (card[row].every((num, col) => (row === 2 && col === 2 && num === 0) || markedNumbers.includes(num))) {
      winners.push(`Row ${row + 1}`);
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      const num = card[row][col];
      if (!(row === 2 && col === 2 && num === 0) && !markedNumbers.includes(num)) {
        complete = false;
        break;
      }
    }
    if (complete) winners.push(`Column ${col + 1}`);
  }

  // Check diagonals
  let diagonal1Complete = true;
  let diagonal2Complete = true;

  for (let i = 0; i < 5; i++) {
    if (!(i === 2 && card[i][i] === 0) && !markedNumbers.includes(card[i][i])) diagonal1Complete = false;
    if (!(i === 2 && card[i][4 - i] === 0) && !markedNumbers.includes(card[i][4 - i])) diagonal2Complete = false;
  }

  if (diagonal1Complete) winners.push('Diagonal 1');
  if (diagonal2Complete) winners.push('Diagonal 2');

  return winners;
};

// New function: Validate card based on game type
export const validateCardByGameType = (
  card: number[][],
  markedNumbers: number[],
  patterns: GamePattern[],
  gameType: string
): { valid: boolean; winningLines: string[]; patternName: string } => {
  let patternToCheck: boolean[][] | null = null;
  let winningLines: string[] = [];

  if (["Full House", "Cross Pattern", "Four Corners"].includes(gameType)) {
    patternToCheck = patterns.find((p) => p.name === gameType)?.pattern ?? null;
    if (patternToCheck) {
      const valid = validateBingo(card, markedNumbers, patternToCheck);
      winningLines = checkLinePatterns(card, markedNumbers);
      return { valid, winningLines, patternName: gameType };
    }
  }

  // For Any 1 Line / Any 2 Lines
  winningLines = checkLinePatterns(card, markedNumbers);
  if (gameType === "Any 1 Line") return { valid: winningLines.length >= 1, winningLines, patternName: gameType };
  if (gameType === "Any 2 Lines") return { valid: winningLines.length >= 2, winningLines, patternName: gameType };

  return { valid: false, winningLines: [], patternName: gameType };
};

// Generate call sequence
export const generateCallSequence = (numberRange: number): number[] => {
  const numbers: number[] = [];
  for (let i = 1; i <= numberRange; i++) numbers.push(i);

  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
};

// Speech
export const speakNumber = (number: number, letter: string, voiceType: string) => {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`${letter} ${number}`);
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find((v) => v.name.toLowerCase().includes(voiceType.toLowerCase()));
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
};

// Export CSV
export const exportGameData = (game: any, calls: any[], format: 'csv' | 'pdf' = 'csv') => {
  if (format === 'csv') {
    const csvData = [
      ['Game ID', 'Title', 'Host', 'Status', 'Created At'],
      [game.id, game.title, game.host_id, game.status, game.created_at],
      [],
      ['Call Order', 'Number', 'Letter', 'Called At'],
      ...calls.map(c => [c.call_order, c.number, c.letter, c.called_at])
    ];
    const csvContent = csvData.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-${game.id}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
