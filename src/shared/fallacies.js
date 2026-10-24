// The reasoning issues Socrates looks for, in three categories: six core
// logical fallacies, cognitive biases (which aren't necessarily fallacies),
// and unsupported assumptions. The ids
// double as the enum the model is constrained to, so keep them stable.
// Names are sentence case: the UI always presents a finding as "Possible
// <name>", because Socrates can be wrong and the writer may have context.

export const CATEGORIES = {
  fallacy: "Logical fallacy",
  bias: "Cognitive bias",
  assumption: "Unsupported assumption",
};

export const FALLACIES = {
  // --- Logical fallacies ---------------------------------------------------
  ad_hominem: {
    category: "fallacy",
    name: "Ad hominem",
    blurb: "Attacking the person making an argument instead of addressing the argument itself.",
    question: "Setting aside who said it, what's wrong with the argument itself?",
  },
  straw_man: {
    category: "fallacy",
    name: "Straw man",
    blurb: "Misrepresenting someone's argument to make it easier to attack.",
    question: "Would the other side agree that this is a fair summary of what they think?",
  },
  false_dilemma: {
    category: "fallacy",
    name: "False dilemma",
    blurb: "Presenting only two options when other reasonable alternatives exist.",
    question: "Are these really the only two options available?",
  },
  hasty_generalization: {
    category: "fallacy",
    name: "Hasty generalisation",
    blurb: "Drawing a broad conclusion from insufficient or unrepresentative evidence.",
    question: "How many cases is this based on, and would a larger sample agree?",
  },
  false_cause: {
    category: "fallacy",
    name: "False cause",
    blurb: "Assuming one event caused another without sufficient evidence of causation.",
    question: "What else happened at the same time, and how would you rule it out?",
  },
  circular_reasoning: {
    category: "fallacy",
    name: "Circular reasoning",
    blurb: "Using a conclusion as part of the justification for that same conclusion.",
    question: "What independent reason supports this, without assuming it's already true?",
  },

  // --- Cognitive biases ----------------------------------------------------
  sunk_cost: {
    category: "bias",
    name: "Sunk-cost reasoning",
    blurb: "Letting what's already been spent drive a decision, instead of the costs and benefits ahead.",
    question: "If you were deciding today, without considering what's already been spent, would you still choose this?",
  },
  confirmation_bias: {
    category: "bias",
    name: "Confirmation bias",
    blurb: "Favouring information that supports what's already believed.",
    question: "What evidence would change this view, and has anyone looked for it?",
  },
  overconfidence: {
    category: "bias",
    name: "Overconfidence",
    blurb: "Being more certain of a judgement or outcome than the evidence supports.",
    question: "How sure can anyone really be here, and what could prove it wrong?",
  },
  anchoring: {
    category: "bias",
    name: "Anchoring",
    blurb: "Relying too heavily on the first number or idea encountered.",
    question: "Without that first figure, what would a reasonable estimate be?",
  },
  survivorship_bias: {
    category: "bias",
    name: "Survivorship bias",
    blurb: "Drawing conclusions only from the successes that remain visible.",
    question: "What about the cases that failed and nobody heard about?",
  },

  // --- Unsupported assumptions ---------------------------------------------
  unsupported_claim: {
    category: "assumption",
    name: "Unsupported factual claim",
    blurb: "Stating something as fact without evidence that supports it.",
    question: "Where does this claim come from, and how could it be checked?",
  },
  unrepresentative_evidence: {
    category: "assumption",
    name: "Unrepresentative evidence",
    blurb: "Drawing a conclusion from examples or data that may not represent the whole picture.",
    question: "Are these examples typical, or might they be unusual cases?",
  },
  alternative_explanations: {
    category: "assumption",
    name: "Unexamined alternative explanations",
    blurb: "Settling on one explanation without considering other plausible causes.",
    question: "What else could explain this, and how would you tell the explanations apart?",
  },
  unjustified_prediction: {
    category: "assumption",
    name: "Unjustified prediction",
    blurb: "Predicting an outcome with more certainty than the evidence supports.",
    question: "What would have to happen for this prediction to come true, and how likely is each step?",
  },
  missing_decision_criteria: {
    category: "assumption",
    name: "Missing decision criteria",
    blurb: "Reaching a decision without saying what it should be judged against.",
    question: "What criteria should this decision be judged on, and how do the options compare?",
  },
};

export const FALLACY_IDS = Object.keys(FALLACIES);

export function fallacyName(id) {
  return FALLACIES[id]?.name ?? id;
}

export function possibleName(id) {
  const name = fallacyName(id);
  return `Possible ${name[0].toLowerCase()}${name.slice(1)}`;
}

export function categoryName(id) {
  return CATEGORIES[FALLACIES[id]?.category] ?? "";
}
