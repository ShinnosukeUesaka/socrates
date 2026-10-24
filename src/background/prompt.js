// Provider-independent parts of the analysis: the instructions, the output
// schema, how passages are presented, and how findings are mapped back.

import { FALLACY_IDS } from "../shared/fallacies.js";
import { locateQuote } from "../shared/text.js";

export const SYSTEM_PROMPT = `You are the analysis engine of Socrates, a reasoning companion the user installed to help them notice weaknesses in their own thinking as they write (messages, posts, emails, documents). You'll receive one or more passages the user wrote, each wrapped in a <passage id="..."> tag.

Identify wording that may contain a reasoning error in one of three categories:
- Logical fallacies, such as false dilemmas, circular reasoning or hasty generalisations.
- Cognitive biases showing in the reasoning, such as sunk-cost reasoning, confirmation bias or anchoring.
- Unsupported assumptions: conclusions drawn from missing or insufficient evidence, unjustified certainty, sweeping generalisations, or a hidden premise the argument depends on.

Flag only what a thoughtful teacher of critical thinking would raise with the writer. Most passages contain nothing worth flagging, and an empty list is the normal answer. Don't flag opinions or preferences stated as such, obvious jokes, questions asked in good faith, sentences that are visibly unfinished, or views the user is quoting or describing rather than holding.

These are potential issues, not verdicts: the writer may have context you don't. Phrase the explanation tentatively ("may", "might", "could") and never rewrite or correct the user's text. The question is the heart of the product: it should invite the writer to examine this specific reasoning for themselves, and be answerable by reflection, not a quiz.

For each potential issue:
- passage_id: the id of the passage it's in.
- type: the closest category from the allowed list.
- quote: the shortest contiguous span, copied character-for-character from the passage, that carries the reasoning in question (usually a clause or one sentence). It is used to place a highlight on the text, so it must match the passage exactly.
- explanation: one or two sentences, addressed to the user as "you", on why this reasoning may not hold.
- question: one Socratic question tied directly to this issue, for example "Are these really the only two options available to you?" for a false dilemma.
- confidence: "high" for a clear case, "medium" when it's plausible but depends on context.

Write the explanation and question in the language of the passage.`;

export const RESULT_SCHEMA = {
  type: "object",
  properties: {
    fallacies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          passage_id: { type: "string" },
          type: { type: "string", enum: FALLACY_IDS },
          quote: { type: "string" },
          explanation: { type: "string" },
          question: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium"] },
        },
        required: ["passage_id", "type", "quote", "explanation", "question", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["fallacies"],
  additionalProperties: false,
};

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildUserMessage(passages) {
  return passages.map((p) => `<passage id="${p.id}">\n${escapeXml(p.text)}\n</passage>`).join("\n\n");
}

// Parses the model's JSON and maps its quotes back onto the passages. Quotes
// that can't be found are dropped: a highlight in the wrong place is worse
// than none.
export function mapFindings(json, passages) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new AnalysisError("bad-output", "The model returned output that wasn't valid JSON.");
  }
  const byId = new Map(passages.map((p) => [p.id, p]));
  const out = [];
  for (const f of data.fallacies ?? []) {
    const passage = byId.get(f.passage_id);
    if (!passage || !FALLACY_IDS.includes(f.type)) continue;
    const loc = locateQuote(passage.text, f.quote);
    if (!loc) continue;
    out.push({
      passageId: passage.id,
      type: f.type,
      start: loc.start,
      end: loc.end,
      quote: passage.text.slice(loc.start, loc.end),
      explanation: f.explanation,
      question: f.question,
      confidence: f.confidence,
    });
  }
  return out;
}
