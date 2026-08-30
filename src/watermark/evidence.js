const DEFAULT_NGRAM_SIZE = 4;

function keyForWindow(values) {
  return values.join(".");
}

export function sequenceWindows(sequence, size = DEFAULT_NGRAM_SIZE) {
  if (sequence.length < size) return [];

  const windows = [];
  for (let index = 0; index <= sequence.length - size; index += 1) {
    windows.push(keyForWindow(sequence.slice(index, index + size)));
  }
  return windows;
}

export function longestCommonContiguousRun(left, right) {
  if (left.length === 0 || right.length === 0) return 0;

  let longest = 0;
  let previous = new Uint16Array(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Uint16Array(right.length + 1);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      }
    }
    previous = current;
  }

  return longest;
}

export function scoreSequence(candidate, source, ngramSize = DEFAULT_NGRAM_SIZE) {
  const candidateWindows = sequenceWindows(candidate, ngramSize);
  const sourceWindows = new Set(sequenceWindows(source, ngramSize));
  const matchedWindows = candidateWindows.filter((window) => sourceWindows.has(window)).length;
  const longestRun = longestCommonContiguousRun(candidate, source);

  return {
    candidateSymbols: candidate.length,
    matchedWindows,
    totalWindows: candidateWindows.length,
    windowCoverage: candidateWindows.length === 0 ? 0 : matchedWindows / candidateWindows.length,
    longestRun,
  };
}

export function classifyEvidence(evidence) {
  if (evidence.candidateSymbols === 0) return "not_detected";
  if (evidence.candidateSymbols < 8) return "insufficient_evidence";

  const strongContiguousEvidence = evidence.longestRun >= 8;
  const strongDistributedEvidence = evidence.matchedWindows >= 3 && evidence.windowCoverage >= 0.25;

  if (strongContiguousEvidence || strongDistributedEvidence) return "verified";
  if (evidence.longestRun >= 4 || evidence.matchedWindows >= 1) return "possible";
  return "not_detected";
}

