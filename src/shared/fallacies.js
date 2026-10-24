// Catalog of reasoning issues Socrates knows about, in three categories. The
// ids double as the enum Claude is constrained to, so keep them stable.
// Names are sentence case: the UI uppercases tags and writes "Possible <name>".

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
    blurb: "Attacking the person instead of their argument.",
    question: "If someone you respect made the same claim, what would you say against the claim itself?",
  },
  straw_man: {
    category: "fallacy",
    name: "Straw man",
    blurb: "Arguing against a distorted, weaker version of the other position.",
    question: "Would the other person agree that this is a fair summary of what they think?",
  },
  false_dilemma: {
    category: "fallacy",
    name: "False dilemma",
    blurb: "Presenting two options as the only ones when others may exist.",
    question: "Are these really the only two options available to you?",
  },
  slippery_slope: {
    category: "fallacy",
    name: "Slippery slope",
    blurb: "Claiming one step will inevitably lead to an extreme outcome without showing each link.",
    question: "What evidence shows each step in that chain would actually happen?",
  },
  hasty_generalization: {
    category: "fallacy",
    name: "Hasty generalisation",
    blurb: "Drawing a broad conclusion from too few examples.",
    question: "How many cases is this based on, and would a larger sample agree?",
  },
  anecdotal_evidence: {
    category: "fallacy",
    name: "Anecdotal evidence",
    blurb: "Using a personal story in place of representative evidence.",
    question: "Is this one case typical, or is it the exception people remember?",
  },
  appeal_to_authority: {
    category: "fallacy",
    name: "Appeal to authority",
    blurb: "Treating a claim as true because an (often unnamed or irrelevant) authority said it.",
    question: "Which source exactly, and what evidence did they give?",
  },
  appeal_to_popularity: {
    category: "fallacy",
    name: "Bandwagon",
    blurb: "Treating something as true or good because many people believe or do it.",
    question: "If most people believed the opposite, would that change whether it's true?",
  },
  appeal_to_emotion: {
    category: "fallacy",
    name: "Appeal to emotion",
    blurb: "Using feelings in place of reasons to win the point.",
    question: "Once the emotion is set aside, what reason is left?",
  },
  appeal_to_ignorance: {
    category: "fallacy",
    name: "Appeal to ignorance",
    blurb: "Claiming something is true because it hasn't been proven false (or vice versa).",
    question: "Does a lack of disproof actually count as evidence for the claim?",
  },
  burden_of_proof: {
    category: "fallacy",
    name: "Shifting the burden of proof",
    blurb: "Asking others to disprove a claim instead of supporting it yourself.",
    question: "What evidence would you offer if no one challenged you?",
  },
  appeal_to_nature: {
    category: "fallacy",
    name: "Appeal to nature",
    blurb: "Assuming what's natural is good (or what's unnatural is bad).",
    question: "Can you think of something natural that's harmful, or unnatural that's helpful?",
  },
  appeal_to_tradition: {
    category: "fallacy",
    name: "Appeal to tradition",
    blurb: "Assuming something is right because it's always been done that way.",
    question: "Why was it done this way originally, and do those reasons still hold?",
  },
  tu_quoque: {
    category: "fallacy",
    name: "Tu quoque",
    blurb: "Deflecting criticism by pointing out the critic's own behaviour (whataboutism).",
    question: "Even if they're inconsistent, could their point still be correct?",
  },
  red_herring: {
    category: "fallacy",
    name: "Red herring",
    blurb: "Switching to a different topic instead of addressing the point.",
    question: "How does this connect back to the original question?",
  },
  false_cause: {
    category: "fallacy",
    name: "False cause",
    blurb: "Assuming that because one thing followed another, the first caused it.",
    question: "What else could explain this, and how would you rule it out?",
  },
  circular_reasoning: {
    category: "fallacy",
    name: "Circular reasoning",
    blurb: "Using the conclusion as its own evidence.",
    question: "What independent reason supports this, without assuming it's already true?",
  },
  no_true_scotsman: {
    category: "fallacy",
    name: "No true Scotsman",
    blurb: "Redefining a group to dismiss counterexamples.",
    question: "What would count as a real counterexample to your claim?",
  },
  loaded_question: {
    category: "fallacy",
    name: "Loaded question",
    blurb: "Asking a question that smuggles in an unproven assumption.",
    question: "What assumption is built into this question, and is it established?",
  },
  genetic_fallacy: {
    category: "fallacy",
    name: "Genetic fallacy",
    blurb: "Judging a claim by where it came from instead of its merits.",
    question: "Setting the source aside, does the claim hold up on its own?",
  },
  middle_ground: {
    category: "fallacy",
    name: "Middle ground",
    blurb: "Assuming the truth must be a compromise between two positions.",
    question: "Could one side simply be right, rather than the answer being in between?",
  },
  composition_division: {
    category: "fallacy",
    name: "Composition / division",
    blurb: "Assuming what's true of the parts is true of the whole, or vice versa.",
    question: "Does this property really transfer between the parts and the whole?",
  },
  moving_the_goalposts: {
    category: "fallacy",
    name: "Moving the goalposts",
    blurb: "Changing the standard of proof once the original one is met.",
    question: "What evidence would have satisfied you before, and has it been met?",
  },
  special_pleading: {
    category: "fallacy",
    name: "Special pleading",
    blurb: "Applying a rule to others while exempting yourself or your side without justification.",
    question: "What justifies treating this case differently from the others?",
  },
  cherry_picking: {
    category: "fallacy",
    name: "Cherry picking",
    blurb: "Highlighting the evidence that fits and ignoring what doesn't.",
    question: "What evidence points the other way, and how does it change the picture?",
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
    blurb: "Favouring information that supports what you already believe.",
    question: "What evidence would change your mind, and have you looked for it?",
  },
  anchoring: {
    category: "bias",
    name: "Anchoring",
    blurb: "Relying too heavily on the first number or idea you encountered.",
    question: "If you'd never seen that first figure, what would you estimate?",
  },
  availability_bias: {
    category: "bias",
    name: "Availability bias",
    blurb: "Judging how likely something is by how easily examples come to mind.",
    question: "Is this actually common, or just memorable or recent?",
  },
  overconfidence: {
    category: "bias",
    name: "Overconfidence",
    blurb: "Being more certain of a judgement or outcome than the evidence supports.",
    question: "What would have to go wrong for this to fail, and how likely is that?",
  },
  survivorship_bias: {
    category: "bias",
    name: "Survivorship bias",
    blurb: "Drawing conclusions only from the successes that remain visible.",
    question: "What about the cases that failed and you never heard about?",
  },
  hindsight_bias: {
    category: "bias",
    name: "Hindsight bias",
    blurb: "Seeing past events as more predictable than they really were.",
    question: "With only what was known at the time, would the outcome really have seemed obvious?",
  },
  status_quo_bias: {
    category: "bias",
    name: "Status quo bias",
    blurb: "Preferring things to stay as they are simply because that's how they are.",
    question: "If the current situation were a new proposal, would you choose it?",
  },

  // --- Unsupported assumptions ---------------------------------------------
  unsupported_claim: {
    category: "assumption",
    name: "Unsupported assumption",
    blurb: "A conclusion that rests on evidence that isn't given or isn't enough.",
    question: "What evidence supports this, and would it convince someone who disagrees?",
  },
  unjustified_certainty: {
    category: "assumption",
    name: "Unjustified certainty",
    blurb: "Stating something as certain when the evidence only makes it possible or likely.",
    question: "How sure can you really be, and what could prove you wrong?",
  },
  sweeping_generalization: {
    category: "assumption",
    name: "Sweeping generalisation",
    blurb: "A claim about everyone or everything that ignores exceptions.",
    question: "Is this true of all of them, or of some? What would an exception look like?",
  },
  hidden_assumption: {
    category: "assumption",
    name: "Hidden assumption",
    blurb: "The argument depends on an unstated premise that may not hold.",
    question: "What would have to be true for this to follow, and is it?",
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
