/**
 * Relative quality of chat models on a 1 to 3 scale. These numbers are a heuristic of ours, not a benchmark:
 * they only decide which model to prefer when the budget allows more than the cheapest option. Edit freely.
 * Models not listed get `DEFAULT_QUALITY`.
 */
export const CHAT_QUALITY: Record<string, 1 | 2 | 3> = {
  "0gm-1.0-35b-a3b": 2,
  "0gm-1.0-35b-a3b-sia": 2,
  "glm-5.3": 3,
};

export const DEFAULT_QUALITY = 2;

export function chatQuality(modelId: string): 1 | 2 | 3 {
  return CHAT_QUALITY[modelId] ?? DEFAULT_QUALITY;
}
