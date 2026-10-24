// Offline fallback detector: phrase patterns that strongly signal a fallacy.
// Much less accurate than Claude (no context, no nuance), so it stays
// conservative and only fires on well-known tell-tale wording. Patterns run
// against normalize()d sentences: lowercase, straight quotes, single spaces.

import { FALLACIES } from "./fallacies.js";
import { normalize, splitSentences } from "./text.js";

const P = (type, confidence, ...res) => res.map((re) => ({ type, confidence, re }));

const NAMED_SOURCE_RE = /https?:|www\.|\b(?:19|20)\d{2}\b|according to|published|journal|et al|\bdoi\b/;

const PATTERNS = [
  ...P("ad_hominem", "high",
    /\b(?:you're|you are|he's|he is|she's|she is|they're|they are|ur)\s+(?:just\s+|such\s+|so\s+|clearly\s+|obviously\s+)?(?:an?\s+)?(?:idiot|moron|clown|loser|fool|imbecile|troll|shill|hack)s?\b/,
    /\bwhat (?:would|does|do) (?:you|he|she|they|a [a-z]+) (?:even )?know about\b/,
    /\b(?:of course|naturally|obviously) (?:you'd|you would|he'd|he would|she'd|she would|they'd|they would) (?:say|think|believe) (?:that|so)\b/,
    /\bcoming from (?:you|someone who|a guy who|a person who|somebody who)\b/,
    /\b(?:you're|you are|he's|he is|she's|she is) (?:only|just) saying (?:that|this) because\b/,
  ),
  ...P("ad_hominem", "medium",
    /\b(?:you're|you are|he's|he is|she's|she is|they're|they are)\s+(?:just\s+|so\s+|clearly\s+|obviously\s+)?(?:an?\s+)?(?:stupid|dumb|ignorant|liar|snowflake|boomer)s?\b/,
    /\b(?:don't|do not|never) (?:listen to|trust|believe) (?:him|her|them|anything (?:he|she|they) says?)\b.*\b(?:because|since|he's|she's|they're)\b/,
  ),
  ...P("straw_man", "high",
    /\bso (?:you're|you are) (?:basically |really |just )?saying\b/,
    /\bso what you're (?:really |basically )?saying is\b/,
  ),
  ...P("straw_man", "medium",
    /\bso (?:you|they|he|she) (?:basically |just )?(?:want|think|believe) (?:that )?(?:we should (?:all|just)|everyone should|nobody should|no one should)\b/,
    /\b(?:you|they) (?:obviously |clearly )?(?:just )?want (?:everyone|all of us|us all|people|the country) to (?:starve|die|suffer|be poor|have nothing)\b/,
  ),
  ...P("false_dilemma", "high",
    /\b(?:you're|you are) either (?:with|for) (?:us|me)\b/,
    /\bif you(?:'re| are) not (?:with|for) (?:us|me)\b/,
    /\bthere (?:are|is) only two (?:options|choices|ways|possibilities|kinds of people|types of people)\b/,
    /\blove it or leave it\b/,
  ),
  ...P("false_dilemma", "medium",
    /\b(?:it's|it is) either\b.{2,80}\bor\b/,
    /\bthe only (?:alternative|other option|other choice) is\b/,
    /\beither (?:we|you|they)\b.{2,80}\bor (?:we|you|they|everything|nothing)\b/,
  ),
  ...P("unjustified_prediction", "high",
    /\bnext thing you know\b/,
    /\bbefore you know it\b/,
    /\bwhere (?:does|will) it (?:end|stop)\b/,
    /\bopen(?:s|ing)? the floodgates\b/,
  ),
  ...P("unjustified_prediction", "medium",
    /\b(?:it's|it is|that's) a slippery slope\b/,
    /\bif (?:we|you|they)\b.{3,100}\b(?:then (?:soon|eventually|next)|it(?:'s| is) only a matter of time|soon (?:everyone|we'll|they'll|people will))\b/,
  ),
  ...P("unsupported_claim", "high",
    /\b(?:everyone|everybody) knows\b/,
    /\b(?:can't|cannot) all be wrong\b/,
    /\bmillions of [a-z]+ can't be wrong\b/,
    /\beveryone(?: else)? (?:is doing it|does it)\b/,
  ),
  ...P("unsupported_claim", "medium",
    /\b(?:it's|it is|that's) (?:so |really )?popular\b.{0,30}\b(?:so|therefore|must be|it has to be)\b/,
  ),
  ...P("unsupported_claim", "high",
    /\bbecause (?:i|he|she|they|my (?:boss|dad|mom|teacher|professor|doctor)) said so\b/,
    /\bif it's good enough for\b/,
  ),
  ...P("unsupported_claim", "medium",
    /\b(?:experts|scientists|doctors|studies|researchers) (?:say|says|agree|have (?:shown|proven|proved)|show|prove)\b/,
    /\bmy (?:professor|doctor|dad|mom|father|mother|teacher|boss|pastor|uncle) (?:says|said|told me)\b.{0,60}\b(?:so|therefore|which means)\b/,
  ),
  ...P("unsupported_claim", "high",
    /\bprove me wrong\b/,
    /\byou (?:can't|cannot) prove (?:i'm|i am) wrong\b/,
    /\b(?:until|unless) you (?:can )?prove (?:otherwise|it(?:'s| is)? (?:not|false|wrong))\b/,
  ),
  ...P("unsupported_claim", "high",
    /\b(?:no one|nobody|science) (?:has|have|has ever|have ever|has never|can|can't|cannot)(?: ever)? (?:proven?|proved|disproven?|disproved|shown)\b.{0,60}\b(?:so|therefore)\b/,
    /\b(?:can't|cannot|couldn't) prove (?:it|that|they|he|she)(?:'s| is| was)? (?:not|isn't|wasn't|didn't|doesn't)\b/,
  ),
  ...P("unsupported_claim", "medium",
    /\bthere(?:'s| is) no (?:proof|evidence) (?:that )?(?:it|this|that|they|he|she)\b.{0,40}\b(?:so|therefore) (?:it|they|he|she)(?:'s| is| are| must)\b/,
  ),
  ...P("unrepresentative_evidence", "high",
    /\bmy (?:grand(?:pa|ma|father|mother|dad|mom)|great[- ]grand(?:father|mother|pa|ma)|uncle|aunt|dad|mom|father|mother|friend|cousin|neighbou?r|brother|sister|co-?worker)\b.{0,100}\b(?:and|but) (?:he|she|they)(?:'s| is| was| were| are)? (?:lived|never|turned out|is fine|was fine|is still|was perfectly|is perfectly|is healthy|was healthy)\b/,
    /\b(?:it|this|that) worked for me,? so\b/,
  ),
  ...P("unrepresentative_evidence", "medium",
    /\bi (?:know|knew) (?:a guy|someone|somebody|a person) who\b.{0,100}\b(?:so|therefore)\b/,
  ),
  ...P("hasty_generalization", "high",
    /\b(?:they're|they are) all (?:the same|like that)\b/,
    /\b(?:all|every) [a-z]+s? (?:are|is) (?:the same|like that)\b/,
  ),
  ...P("hasty_generalization", "medium",
    /\b(?:i met|i've met|i know|i saw|i had)\b.{0,60}\b(?:one|a|two|a couple of|a few)\b.{0,60}\b(?:so|therefore)\b.{0,40}\b(?:all|every|they're all|they are all|everyone|always|never)\b/,
  ),
  ...P("false_cause", "high",
    /\bmust (?:have|'ve) (?:caused|been caused by)\b/,
  ),
  ...P("false_cause", "medium",
    /\bever since\b.{3,100}\b(?:so|which (?:means|proves)|that's why|clearly|must)\b/,
    /\bafter (?:i|we|they|he|she|you|the)\b.{3,80}\b(?:so (?:it|that) (?:must|has to)|it must (?:have been|be)|that's (?:why|what caused)|which (?:means|proves) (?:it|that))\b/,
  ),
  ...P("circular_reasoning", "high",
    /\b(?:it's|it is|that's|that is|they're|they are|he's|she's) (?:true|right|correct|good|bad|wrong|the best|the worst) because (?:it|that|they|he|she)(?:'s| is| are)? (?:true|right|correct|good|bad|wrong|the best|the worst)\b/,
    /\bbecause (?:the |my )?(?:bible|book|scripture|manual|rules|law|it) (?:says|said) so\b/,
  ),
  ...P("sunk_cost", "high",
    /\b(?:we|i|they)(?:'ve| have)? (?:already )?(?:spent|invested|put|wasted|sunk|paid|poured)\b.{0,80}\b(?:can't|cannot|shouldn't|won't|mustn't) (?:quit|stop|give up|turn back|back out|walk away|abandon)\b/,
    /\b(?:already )?(?:spent|invested|sunk|paid|poured)\b.{0,80}\b(?:have to|must|need to|got to|gotta) (?:keep going|continue|keep at it|finish|see it through|stick with)\b/,
    /\b(?:will have been|would have been|would be|was all) (?:wasted|for nothing|in vain)\b/,
    /\btoo (?:far|much) (?:in|invested)\b.{0,20}\bto (?:quit|stop|give up|turn back|back out)\b/,
    /\bwe(?:'ve| have) come too far\b/,
  ),
  ...P("hasty_generalization", "high",
    /\b(?:everyone|everybody|all of (?:them|you)|all (?:these|those) people|people|they)(?: here| else)? (?:is|are) (?:all |just |so |completely |totally )?(?:stupid|idiots?|dumb|morons?|sheep|brainwashed|lazy|evil|liars?|selfish|clueless|useless|crazy)\b/,
    /\b(?:nobody|no one)(?: here| else)? (?:cares|knows anything|has a clue|ever listens)\b/,
  ),
  ...P("overconfidence", "medium",
    /\b(?:it's|it is|that's|this is) (?:obviously|clearly|definitely|undeniably|unquestionably) (?:true|false|right|wrong|the best|the worst|going to (?:work|fail))\b/,
    /\bthere(?:'s| is) (?:absolutely )?no (?:doubt|question) (?:that|about it)\b/,
    /\b(?:100%|guaranteed) (?:to (?:work|succeed|fail)|it will)\b/,
  ),
  ...P("overconfidence", "medium",
    /\b(?:can't|cannot|won't|will never) (?:possibly )?(?:fail|go wrong|lose)\b/,
    /\bnothing (?:can|could) (?:possibly )?go wrong\b/,
  ),
  ...P("confirmation_bias", "medium",
    /\bi (?:only|just) (?:read|watch|listen to|follow|trust) (?:sources|people|news|channels|sites)\b.{0,30}\b(?:agree|confirm|support|share)\b/,
  ),
];

const MAX_PER_SENTENCE = 2;

// Returns fallacies with offsets local to `text`.
export function detectHeuristic(text) {
  const out = [];
  for (const sentence of splitSentences(text)) {
    const norm = normalize(sentence.text);
    const seen = new Set();
    for (const { type, confidence, re } of PATTERNS) {
      if (seen.has(type) || seen.size >= MAX_PER_SENTENCE) continue;
      if (!re.test(norm)) continue;
      if (type === "unsupported_claim" && NAMED_SOURCE_RE.test(norm)) continue;
      seen.add(type);
      out.push({
        type,
        start: sentence.start,
        end: sentence.end,
        quote: sentence.text,
        explanation: FALLACIES[type].blurb,
        question: FALLACIES[type].question,
        confidence,
      });
    }
  }
  return out;
}
