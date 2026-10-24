import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLACY_IDS } from "../../src/shared/fallacies.js";
import { detectHeuristic } from "../../src/shared/heuristics.js";

const POSITIVE = [
  ["false_dilemma", "You're either with us or against us."],
  ["false_dilemma", "There are only two options: ban it or accept chaos."],
  ["unjustified_prediction", "If we allow remote work, next thing you know nobody will ever come to the office."],
  ["unsupported_claim", "Everyone knows that this diet works."],
  ["unsupported_claim", "Millions of fans can't be wrong."],
  ["ad_hominem", "You're an idiot, so nobody should listen to your plan."],
  ["ad_hominem", "What would you even know about economics?"],
  ["straw_man", "So you're saying we should just let criminals walk free?"],
  ["unsupported_claim", "Experts say it's safe, so stop worrying."],
  ["unsupported_claim", "We do it this way because I said so."],
  ["unsupported_claim", "Aliens built the pyramids, prove me wrong."],
  ["unsupported_claim", "Nobody has ever proven ghosts don't exist, so they must be real."],
  ["unrepresentative_evidence", "My grandpa smoked every day and he lived to 95."],
  ["hasty_generalization", "I met two rude tourists from there, so they are all like that."],
  ["hasty_generalization", "Everyone is stupid."],
  ["hasty_generalization", "Honestly, people are so lazy these days."],
  ["circular_reasoning", "The book is true because the book says so."],
  ["sunk_cost", "We've already spent two years on this, we can't quit now."],
  ["sunk_cost", "We've already invested €20,000 in our startup, so we have to keep going or all that money will have been wasted."],
  ["sunk_cost", "We spent so much time on this project, we cannot quit now."],
  ["false_cause", "Ever since we got the new manager sales dropped, so clearly she's the problem."],
  ["overconfidence", "There's no doubt that this is the right call."],
  ["overconfidence", "Relax, this plan can't fail."],
  ["confirmation_bias", "I only read sources that agree with me, and they all say I'm right."],
];

const NEGATIVE = [
  "I think we should meet tomorrow to discuss the budget.",
  "According to a 2021 study published in The Lancet, experts say the vaccine is safe.",
  "I'm doing great, what about you?",
  "Either way, let's grab lunch at noon.",
  "Most people think it's hard, but the docs explain it well.",
  "That's a natural fit for the team.",
  "My friend recommended this book and I loved it.",
  "Can you send me the report before Friday?",
  "The truth is that I forgot to reply, sorry!",
  "We spent a week on this design and learned a lot.",
  "Everyone is welcome to join the call.",
  "People are busy this week, so let's meet next Monday.",
  "We have to keep going until the tests pass.",
];

for (const [type, text] of POSITIVE) {
  test(`flags ${type}: ${text}`, () => {
    const found = detectHeuristic(text);
    assert.ok(
      found.some((f) => f.type === type),
      `expected ${type}, got ${JSON.stringify(found.map((f) => f.type))}`,
    );
  });
}

for (const text of NEGATIVE) {
  test(`stays quiet: ${text}`, () => {
    assert.deepEqual(detectHeuristic(text), []);
  });
}

test("results carry sentence offsets, catalog text and known types", () => {
  const text = "Fine weather today. Everyone knows that vaccines are a hoax.";
  const [f] = detectHeuristic(text);
  assert.equal(f.type, "unsupported_claim");
  assert.equal(text.slice(f.start, f.end), "Everyone knows that vaccines are a hoax.");
  assert.equal(f.quote, "Everyone knows that vaccines are a hoax.");
  assert.ok(f.explanation.length > 10 && f.question.length > 10);
  assert.ok(FALLACY_IDS.includes(f.type));
});

test("caps flags per sentence", () => {
  const text = "You're an idiot, everyone knows that, next thing you know you'll say prove me wrong.";
  assert.ok(detectHeuristic(text).length <= 2);
});

test("handles curly apostrophes", () => {
  assert.equal(detectHeuristic("We’ve already spent two years on this, we can’t quit now.")[0]?.type, "sunk_cost");
});
