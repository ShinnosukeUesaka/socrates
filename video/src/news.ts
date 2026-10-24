// Headline montage and stat beats. Every headline, outlet and date was checked against the published article
// (or an archived copy); sources are listed in README.md.
export type Beat = { tag: string; outlet: string; date: string; headline: string; stat: string; to?: number; prefix?: string; suffix?: string; label: string; sub?: string; source: string };

export const NEWS: Record<string, Beat> = {
  mit: {
    tag: 'Twitter · 2006–2017', outlet: 'BBC News', date: 'MAR 9, 2018', headline: 'Fake news ‘travels faster’, study finds',
    stat: '70%', to: 70, suffix: '%', label: 'more likely to be retweeted: false news vs. true news',
    sub: 'True stories took about six times longer to reach 1,500 people.',
    source: 'Vosoughi, Roy & Aral (MIT) · Science · 2018 · ~126,000 stories, ~3 million people',
  },
  wef: {
    tag: 'Worldwide · 2024 & 2025', outlet: 'The Guardian', date: 'JAN 10, 2024', headline: 'AI-driven misinformation ‘biggest short-term threat to global economy’',
    stat: '#1', label: 'global risk for the next two years: misinformation & disinformation',
    sub: 'Ranked first by the WEF’s risk experts in 2024, and again in 2025.',
    source: 'World Economic Forum · Global Risks Report 2024 (1,490 experts) & 2025 (900+ experts) · two-year outlook',
  },
};

/** Real headlines that pile up around the globe in the cold open. */
export const HEADLINES = [
  'AI-powered misinformation is the world’s biggest short-term threat, Davos report says',
  'The Grim Conclusions of the Largest-Ever Study of Fake News',
  'Students Have ‘Dismaying’ Inability To Tell Fake News From Real, Study Finds',
  'Most Students Don’t Know When News Is Fake, Stanford Study Finds',
  'The dark side of Guardian comments',
  'Microsoft Study Finds AI Makes Human Cognition “Atrophied and Unprepared”',
  'Increased AI use linked to eroding critical thinking skills',
];
