// Catalog of fallacy types the extension knows about. The ids double as the
// enum Claude is constrained to, so keep them stable.

export const FALLACIES = {
  ad_hominem: {
    name: "Ad Hominem",
    blurb: "Attacking the person instead of their argument.",
    question: "If someone you respect made the same claim, what would you say against the claim itself?",
  },
  straw_man: {
    name: "Straw Man",
    blurb: "Arguing against a distorted, weaker version of the other position.",
    question: "Would the other person agree that this is a fair summary of what they think?",
  },
  false_dilemma: {
    name: "False Dilemma",
    blurb: "Presenting two options as the only ones when others exist.",
    question: "Is there a third option, or a middle ground, you haven't mentioned?",
  },
  slippery_slope: {
    name: "Slippery Slope",
    blurb: "Claiming one step will inevitably lead to an extreme outcome without showing each link.",
    question: "What evidence shows each step in that chain would actually happen?",
  },
  hasty_generalization: {
    name: "Hasty Generalization",
    blurb: "Drawing a broad conclusion from too few examples.",
    question: "How many cases is this based on, and would a larger sample agree?",
  },
  anecdotal_evidence: {
    name: "Anecdotal Evidence",
    blurb: "Using a personal story in place of representative evidence.",
    question: "Is this one case typical, or is it the exception people remember?",
  },
  appeal_to_authority: {
    name: "Appeal to Authority",
    blurb: "Treating a claim as true because an (often unnamed or irrelevant) authority said it.",
    question: "Which source exactly, and what evidence did they give?",
  },
  appeal_to_popularity: {
    name: "Bandwagon",
    blurb: "Treating something as true or good because many people believe or do it.",
    question: "If most people believed the opposite, would that change whether it's true?",
  },
  appeal_to_emotion: {
    name: "Appeal to Emotion",
    blurb: "Using feelings in place of reasons to win the point.",
    question: "Once the emotion is set aside, what reason is left?",
  },
  appeal_to_ignorance: {
    name: "Appeal to Ignorance",
    blurb: "Claiming something is true because it hasn't been proven false (or vice versa).",
    question: "Does a lack of disproof actually count as evidence for the claim?",
  },
  burden_of_proof: {
    name: "Shifting the Burden",
    blurb: "Demanding others disprove your claim instead of supporting it yourself.",
    question: "What evidence would you offer if no one challenged you?",
  },
  appeal_to_nature: {
    name: "Appeal to Nature",
    blurb: "Assuming what's natural is good (or what's unnatural is bad).",
    question: "Can you think of something natural that's harmful, or unnatural that's helpful?",
  },
  appeal_to_tradition: {
    name: "Appeal to Tradition",
    blurb: "Assuming something is right because it's always been done that way.",
    question: "Why was it done this way originally, and do those reasons still hold?",
  },
  tu_quoque: {
    name: "Tu Quoque",
    blurb: "Deflecting criticism by pointing out the critic's own behaviour (whataboutism).",
    question: "Even if they're inconsistent, is their point still correct?",
  },
  red_herring: {
    name: "Red Herring",
    blurb: "Switching to a different topic to avoid the actual point.",
    question: "How does this connect back to the original question?",
  },
  false_cause: {
    name: "False Cause",
    blurb: "Assuming that because one thing followed another, the first caused it.",
    question: "What else could explain this, and how would you rule it out?",
  },
  circular_reasoning: {
    name: "Circular Reasoning",
    blurb: "Using the conclusion as its own evidence.",
    question: "What independent reason supports this, without assuming it's already true?",
  },
  no_true_scotsman: {
    name: "No True Scotsman",
    blurb: "Redefining a group to dismiss counterexamples.",
    question: "What would count as a real counterexample to your claim?",
  },
  loaded_question: {
    name: "Loaded Question",
    blurb: "Asking a question that smuggles in an unproven assumption.",
    question: "What assumption is built into this question, and is it established?",
  },
  sunk_cost: {
    name: "Sunk Cost",
    blurb: "Continuing because of what's already been spent rather than what's ahead.",
    question: "Starting fresh today, with no past investment, would you still choose this?",
  },
  genetic_fallacy: {
    name: "Genetic Fallacy",
    blurb: "Judging a claim by where it came from instead of its merits.",
    question: "Setting the source aside, does the claim hold up on its own?",
  },
  middle_ground: {
    name: "Middle Ground",
    blurb: "Assuming the truth must be a compromise between two positions.",
    question: "Could one side simply be right, rather than the answer being in between?",
  },
  composition_division: {
    name: "Composition / Division",
    blurb: "Assuming what's true of the parts is true of the whole, or vice versa.",
    question: "Does this property really transfer between the parts and the whole?",
  },
  moving_the_goalposts: {
    name: "Moving the Goalposts",
    blurb: "Changing the standard of proof once the original one is met.",
    question: "What evidence would have satisfied you before, and has it been met?",
  },
  special_pleading: {
    name: "Special Pleading",
    blurb: "Applying a rule to others while exempting yourself or your side without justification.",
    question: "What justifies treating this case differently from the others?",
  },
  cherry_picking: {
    name: "Cherry Picking",
    blurb: "Highlighting the evidence that fits and ignoring what doesn't.",
    question: "What evidence points the other way, and how does it change the picture?",
  },
};

export const FALLACY_IDS = Object.keys(FALLACIES);

export function fallacyName(id) {
  return FALLACIES[id]?.name ?? id;
}
