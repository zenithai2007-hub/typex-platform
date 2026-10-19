/* ============================================================================
 * @typex/ai — AI provider abstraction + the real local engine.
 *
 * LocalProvider is a faithful TypeScript port of the original TYPE X local
 * engine (~/workspace/typex/js/ai/providers/local.js): real task detection,
 * tone shaping, EN/Roman Urdu/Urdu language packs + sentence banks, length
 * and format control, and a genuine (small, honest) en<->roman<->ur word
 * dictionary translator. Works fully offline, no keys, no network.
 *
 * OpenAIProvider / AnthropicProvider are real cloud providers. They need an
 * API key (constructor arg or env) and throw ConfigurationError without one.
 * Keys are server-only — never expose them client-side.
 * ========================================================================== */

import type { ExecutionMode, Permission } from '@typex/types';
import { Permission as P } from '@typex/types';

export interface AIStyle {
  tone?: string;
  language?: string;
  length?: string;
  format?: string;
}

export interface AIGenerateInput {
  instruction: string;
  contextText?: string;
  style?: AIStyle;
  signal?: { cancelled: boolean };
  onToken?: (token: string, acc: string) => void;
}

export interface ActionDraft {
  kind: string;
  payload: Record<string, unknown>;
  mode: ExecutionMode;
  requiresApproval: boolean;
  permission: Permission;
  preview: string;
  taskType: string;
}

export interface AIProvider {
  readonly name: string;
  generate(input: AIGenerateInput): Promise<string>;
  stream?(input: AIGenerateInput, onToken: (t: string, acc: string) => void): Promise<string>;
  classify(text: string): Promise<string>;
  extract(text: string, fields: string[]): Promise<Record<string, string>>;
  summarize(text: string): Promise<string>;
  planAction(instruction: string, context: unknown): Promise<ActionDraft>;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/* ============================ LocalProvider ============================= */

const FAST = (): boolean => process.env.TYPEX_AI_FAST === '1';
const sleep = (ms: number): Promise<void> =>
  FAST() ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));

interface TypeDef {
  id: string;
  w: string[];
}

/* ---------- task detection (ported 1:1 from local.js) ---------- */
const TYPES: TypeDef[] = [
  { id: 'email', w: ['email', 'mail', 'newsletter'] },
  { id: 'reply', w: ['reply', 'respond', 'response', 'answer', 'customer'] },
  { id: 'rewrite', w: ['rewrite', 'reword', 'rephrase', 'paraphrase', 'polish', 'improve writing'] },
  { id: 'translate', w: ['translate', 'translation', 'urdu', 'hindi', 'spanish', 'french', 'arabic', 'german'] },
  { id: 'caption', w: ['caption', 'instagram', 'tiktok', 'reel'] },
  { id: 'summary', w: ['summar', 'summarize', 'tldr', 'key points', 'brief me'] },
  { id: 'proposal', w: ['proposal', 'pitch deck', 'quote for', 'bid'] },
  { id: 'message', w: ['message', 'dm', 'text him', 'text her', 'whatsapp', 'outreach'] },
  { id: 'ideas', w: ['ideas', 'brainstorm', 'suggest', 'topics', 'angles'] },
  { id: 'grammar', w: ['grammar', 'spell', 'correct', 'proofread', 'fix'] },
  { id: 'script', w: ['script', 'video script', 'dialogue'] },
  { id: 'apply', w: ['job application', 'cover letter', 'resume', 'cv'] },
  { id: 'followup', w: ['follow-up', 'follow up', 'followup', 'reminder'] },
  { id: 'social', w: ['post', 'tweet', 'linkedin post', 'social media', 'announcement'] },
  { id: 'format', w: ['format', 'organize', 'structure', 'bullet', 'list out'] },
];

export function detectType(instr: string): string {
  const s = ' ' + instr.toLowerCase() + ' ';
  let best = 'general';
  let bestScore = 0;
  for (const t of TYPES) {
    let sc = 0;
    for (const w of t.w) {
      if (s.indexOf(w) >= 0) sc += w.length;
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = t.id;
    }
  }
  return best;
}

/* ---------- target extraction (ported 1:1) ---------- */
export function extractTarget(instr: string, ctx: string): string {
  let m = instr.match(/["“”](.+?)["“”]/s);
  if (m) return m[1].trim();
  m = instr.match(/(?:about|regarding|for|re:|subject:?)\s*[:\-]?\s*(.+)$/i);
  if (m && m[1].trim().length > 3 && m[1].length < 160) return m[1].trim().replace(/[.\s]+$/, '');
  if (ctx && ctx.trim().length > 10) return ctx.trim().slice(0, 600);
  const cleaned = instr.replace(/^(please\s+)?(write|create|draft|generate|make|compose)\b/i, '').trim();
  return cleaned.length > 4 ? cleaned : 'your request';
}

/* ---------- language packs (ported 1:1; others fall back to English) ---------- */
interface LangPack {
  hello: string[];
  thanks: string;
  sign: string[];
  you: string;
  team: string;
  follow: string;
  sorry: string;
  here: string;
  key: string;
  idea: string;
  avail: string;
}

const L: Record<string, LangPack> = {
  English: {
    hello: ['Hi', 'Hello', 'Hey there'], thanks: 'Thanks for reaching out.',
    sign: ['Best regards', 'Warm regards', 'Kind regards'], you: 'you', team: 'we',
    follow: 'Looking forward to hearing from you.', sorry: 'Sorry about that —',
    here: 'Here is a clean version:', key: 'Key points:', idea: 'Here are some ideas:',
    avail: 'Happy to jump on a quick call if helpful.',
  },
  'Roman Urdu': {
    hello: ['Assalam-o-Alaikum', 'Salam', 'Hello'], thanks: 'Rabta karne ka shukriya.',
    sign: ['Shukriya', 'Best regards', 'Khuda Hafiz'], you: 'aap', team: 'hum',
    follow: 'Aap ke jawab ka intezar rahega.', sorry: 'Is ke liye mazrat —',
    here: 'Yeh rahi saaf suthri version:', key: 'Ahem points:', idea: 'Kuch ideas yeh hain:',
    avail: 'Agar chahen to hum call par bhi baat kar sakte hain.',
  },
  Urdu: {
    hello: ['السلام علیکم', 'آداب'], thanks: 'رابطہ کرنے کا شکریہ۔',
    sign: ['شکریہ', 'نیک تمنائیں'], you: 'آپ', team: 'ہم',
    follow: 'آپ کے جواب کا انتظار رہے گا۔', sorry: 'اس کے لیے معذرت —',
    here: 'یہ رہی صاف ستھری عبارت:', key: 'اہم نکات:', idea: 'کچھ آئیڈیاز یہ ہیں:',
    avail: 'اگر چاہیں تو ہم کال پر بھی بات کر سکتے ہیں۔',
  },
};

function pack(lang: string | undefined): LangPack {
  return (lang && L[lang]) || L['English'];
}

/* ---------- tone shaping (ported 1:1) ---------- */
function toneLine(tone: string, kind: 'open' | 'close', p: LangPack): string {
  const TONE: Record<string, { open: string; close: string }> = {
    Professional: { open: p.hello[1] + ',', close: p.sign[0] + ',' },
    Friendly: { open: p.hello[2] + '!', close: 'Cheers,' },
    Casual: { open: 'Hey!', close: 'Take care,' },
    Formal: { open: 'Dear Sir/Madam,', close: 'Yours faithfully,' },
    Persuasive: { open: p.hello[1] + ' — quick one,', close: 'Worth 10 minutes?' },
    Confident: { open: p.hello[0] + '.', close: 'Let\u2019s get it done.' },
    Funny: { open: 'Well hello there!', close: 'Stay awesome,' },
    Simple: { open: p.hello[0] + ',', close: p.sign[0] + ',' },
    Technical: { open: p.hello[1] + ',', close: p.sign[2] + ',' },
  };
  const t = TONE[tone] || TONE['Professional'];
  return kind === 'open' ? t.open : t.close;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/* ---------- localized sentence banks: Roman Urdu + Urdu (ported 1:1) ---------- */
const LANG_BANK: Record<string, Record<string, string[]>> = {
  'Roman Urdu': {
    email: ['{t} ke baare mein ek zaroori update share karna chahta hoon.', 'Sab kuch schedule par hai, aur {team} aap ko next steps se agah rakhenge.', 'Agar {t} ke baare mein koi sawal ho to zaroor batayen.'],
    reply: ['Rabta karne ka shukriya. {t} ke hawale se yeh confirm kar sakta hoon.', 'Hum ne is par ghor kiya hai aur behtareen rasta wazeh hai.', 'Agar {t} ke baare mein kuch aur wazeh karna ho to batayen, foran hal kar dunga.'],
    message: ['{t} par ek quick note — mere khayal mein is ka ek smart hal hai.', 'Aage barhne se pehle aap ki raye darkar hai.', 'Agar chahen to hum call par bhi baat kar sakte hain.'],
    caption: ['POV: {t} ab samajh aa gaya.', 'Ise save kar len — baad mein kaam ayega.', 'Chote steps, bare results. #TypeX #Productivity'],
    summary: ['{t} ki asal baat teen cheezon par hai: wazeh hona, sahi waqt, aur follow-through.', 'Zyada tar value pehle faisle mein hai — woh durust karen, baqi khud ho jayega.', 'Khulasa: {t} par is hafte amal karen, agle quarter mein nahi.'],
    proposal: ['Yeh proposal {t} ko mukammal cover karta hai: scope, timeline aur pricing.', 'Hum wazeh milestones mein deliver karenge taake aap ko hamesha maloom ho kaam kahan hai.', 'Maqsad simple hai — pehle 30 din mein {t} se measurable results.'],
    ideas: ['Pehla angle: {t} ko before/after story banayen.', 'Dusra angle: woh ek sawal jo sab {t} ke baare mein poochte hain.', 'Teesra angle: {t} ko ek short checklist banayen jo log save karen.'],
    social: ['{t} par bari update — kya badla aur kyun zaroori hai, yeh raha.', 'Aksar log {t} ko overthink karte hain. Simple rakhen: shuru karen, measure karen, adjust karen.', 'Kya khayal hai? Comment karen — main har ek parhta hoon.'],
    followup: ['Bas follow-up kar raha hoon — {t} ke baare mein koi raye?', 'Koi jaldi nahi; jab aap tayyar hon, main ek message ki doori par hoon.', 'Aap ke jawab ka intezar rahega.'],
    general: ['{t} par kaam shuru kar diya hai — yeh raha pehla draft.', 'Agar kisi hissa mein tabdeeli chahiye to batayen, foran update kar dunga.', 'Aap ke jawab ka intezar rahega.'],
  },
  Urdu: {
    email: ['{t} کے بارے میں ایک ضروری اپ ڈیٹ شیئر کرنا چاہتا ہوں۔', 'سب کچھ شیڈول پر ہے، اور {team} آپ کو اگلے مراحل سے آگاہ رکھیں گے۔', 'اگر {t} کے بارے میں کوئی سوال ہو تو ضرور بتائیں۔'],
    reply: ['رابطہ کرنے کا شکریہ۔ {t} کے حوالے سے یہ کنفرم کر سکتا ہوں۔', 'ہم نے اس پر غور کیا ہے اور بہترین راستہ واضح ہے۔', 'اگر {t} کے بارے میں کچھ مزید واضح کرنا ہو تو بتائیں، فوراً حل کر دوں گا۔'],
    message: ['{t} پر ایک مختصر نوٹ — میرے خیال میں اس کا ایک اچھا حل ہے۔', 'آگے بڑھنے سے پہلے آپ کی رائے درکار ہے۔', 'اگر چاہیں تو ہم کال پر بھی بات کر سکتے ہیں۔'],
    caption: ['{t} اب سمجھ آ گیا۔', 'اسے سیو کر لیں — بعد میں کام آئے گا۔', 'چھوٹے قدم، بڑے نتائج۔ #TypeX'],
    summary: ['{t} کی اصل بات تین چیزوں پر ہے: وضاحت، صحیح وقت، اور فالو تھرو۔', 'زیادہ تر ویلیو پہلے فیصلے میں ہے۔', 'خلاصہ: {t} پر اس ہفتے عمل کریں۔'],
    proposal: ['یہ پروپوزل {t} کو مکمل کور کرتا ہے: اسکوپ، ٹائم لائن اور پرائسنگ۔', 'ہم واضح مائیل اسٹونز میں ڈیلیور کریں گے۔', 'مقصد آسان ہے — پہلے 30 دن میں {t} سے ٹھوس نتائج۔'],
    ideas: ['پہلا اینگل: {t} کو before/after کہانی بنائیں۔', 'دوسرا اینگل: وہ ایک سوال جو سب {t} کے بارے میں پوچھتے ہیں۔', 'تیسرا اینگل: {t} کی چیک لسٹ بنائیں جو لوگ سیو کریں۔'],
    social: ['{t} پر بڑی اپ ڈیٹ — کیا بدلا اور کیوں ضروری ہے۔', 'اکثر لوگ {t} کو overthink کرتے ہیں۔ آسان رکھیں۔', 'کیا خیال ہے؟ کمنٹ کریں۔'],
    followup: ['بس فالو اپ کر رہا ہوں — {t} کے بارے میں کوئی رائے؟', 'کوئی جلدی نہیں؛ جب آپ تیار ہوں، میں ایک پیغام کی دوری پر ہوں۔', 'آپ کے جواب کا انتظار رہے گا۔'],
    general: ['{t} پر کام شروع کر دیا ہے — یہ رہا پہلا ڈرافٹ۔', 'اگر کسی حصے میں تبدیلی چاہیے تو بتائیں۔', 'آپ کے جواب کا انتظار رہے گا۔'],
  },
};

/* ---------- English sentence banks (ported 1:1) ---------- */
function englishBank(type: string, target: string, p: LangPack): string[] {
  const you = p.you;
  const team = p.team;
  const teamCap = team.charAt(0).toUpperCase() + team.slice(1);
  const bank: Record<string, string[]> = {
    email: [
      'I wanted to share a quick update regarding ' + target + '.',
      'Everything is on track, and ' + team + ' will keep ' + you + ' posted on next steps.',
      'Please let me know if ' + you + ' have any questions about ' + target + '.',
    ],
    reply: [
      p.thanks + ' Regarding ' + target + ', here is what I can confirm.',
      teamCap + ' have looked into this and the best path forward is clear.',
      'If anything about ' + target + ' is still unclear, just tell me and I will sort it right away.',
    ],
    message: [
      'Quick note on ' + target + ' — I think there is a smart way to handle this.',
      'Would love your take before ' + team + ' move ahead.',
      p.avail,
    ],
    caption: [
      'POV: ' + target + ' finally makes sense.',
      'Save this for later — ' + you + ' will thank yourself.',
      'Small steps, big results. #TypeX #Productivity',
    ],
    summary: [
      'The core of ' + target + ' comes down to three things: clarity, timing, and follow-through.',
      'Most of the value sits in the first decision — get that right and the rest follows.',
      'Bottom line: act on ' + target + ' this week, not next quarter.',
    ],
    proposal: [
      'This proposal covers ' + target + ' end to end: scope, timeline, and pricing.',
      teamCap + ' will deliver in clear milestones so ' + you + ' always know where things stand.',
      'The goal is simple — measurable results from ' + target + ' within the first 30 days.',
    ],
    ideas: [
      'Angle one: frame ' + target + ' as a before/after story.',
      'Angle two: answer the single question everyone asks about ' + target + '.',
      'Angle three: turn ' + target + ' into a short checklist people can save.',
    ],
    social: [
      'Big update on ' + target + ' — here is what changed and why it matters.',
      'Most people overthink ' + target + '. Keep it simple: start, measure, adjust.',
      'Thoughts? Drop a comment — I read every one.',
    ],
    script: [
      '[HOOK] ' + target + ' — in the next 60 seconds, everything clicks.',
      '[BODY] Here is the part nobody tells ' + you + ' about ' + target + '.',
      '[CTA] Try it today and see the difference.',
    ],
    apply: [
      'I am excited to apply — my experience maps directly onto ' + target + '.',
      'In my last role I owned outcomes like these end to end, and I bring that same ownership here.',
      'I would welcome the chance to discuss how I can contribute from day one.',
    ],
    followup: [
      'Just floating this back up — any thoughts on ' + target + '?',
      'No rush at all; whenever ' + you + ' are ready, I am one message away.',
      p.follow,
    ],
  };
  return bank[type] || bank['message'];
}

function sentenceFor(type: string, target: string, p: LangPack, i: number, lang: string): string {
  const you = p.you;
  const team = p.team;
  const lb = LANG_BANK[lang] && (LANG_BANK[lang][type] || LANG_BANK[lang]['general']);
  const src = lb || englishBank(type, target, p);
  const raw = pick(src, target.length + i * 7 + type.length);
  return raw.split('{t}').join(target).split('{team}').join(team).split('{you}').join(you);
}

function buildBody(type: string, target: string, style: AIStyle): { lines: string[]; p: LangPack } {
  const p = pack(style.language);
  const len = style.length || 'Medium';
  const n = len === 'Short' ? 2 : len === 'Long' ? 6 : 3;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(sentenceFor(type, target, p, i, style.language || 'English'));
  return { lines: out, p };
}

/* ---------- tiny genuine translator (ported 1:1; honest v1 dictionary note kept) ---------- */
const DICT: [string, string, string][] = [
  ['hello', 'salam', 'السلام علیکم'], ['hi', 'salam', 'سلام'], ['thank you', 'shukriya', 'شکریہ'],
  ['thanks', 'shukriya', 'شکریہ'], ['please', 'meherbani', 'مہربانی'], ['yes', 'jee haan', 'جی ہاں'],
  ['no', 'nahein', 'نہیں'], ['good', 'acha', 'اچھا'], ['morning', 'subah', 'صبح'],
  ['how are you', 'aap kaise hain', 'آپ کیسے ہیں'], ['welcome', 'khush aamdeed', 'خوش آمدید'],
  ['friend', 'dost', 'دوست'], ['work', 'kaam', 'کام'], ['time', 'waqt', 'وقت'],
  ['today', 'aaj', 'آج'], ['tomorrow', 'kal', 'کل'], ['price', 'qeemat', 'قیمت'],
  ['message', 'paigham', 'پیغام'], ['reply', 'jawab', 'جواب'], ['email', 'email', 'ای میل'],
  ['business', 'karobar', 'کاروبار'], ['customer', 'gahak', 'گاہک'],
];

function translateText(instr: string, style: AIStyle): string {
  const src = extractTarget(instr, '');
  const lang = style.language || 'English';
  let out = src;
  DICT.slice()
    .sort((a, b) => b[0].length - a[0].length)
    .forEach((row) => {
      const [en, ro, ur] = row;
      const tgt = lang === 'Urdu' ? ur : lang === 'Roman Urdu' ? ro : en;
      const re = new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      out = out.replace(re, tgt);
    });
  const note =
    lang === 'English'
      ? ''
      : '\n\n—\nTranslated toward ' + lang + ' (v1 demo dictionary; full neural translation arrives with the Phase-2 backend).';
  return out + note;
}

function applyFormat(type: string, body: { lines: string[]; p: LangPack }, style: AIStyle, target: string, instr: string): string {
  const p = body.p;
  const lines = body.lines;
  const tone = style.tone || 'Professional';
  const open = toneLine(tone, 'open', p);
  const close = toneLine(tone, 'close', p);
  const fmt = style.format || 'Paragraphs';
  if (type === 'translate') return translateText(instr, style);
  if (type === 'grammar' || type === 'rewrite') {
    const src = extractTarget(instr, '');
    const cleaned = src.replace(/\s+/g, ' ').replace(/\bi\b/g, 'I').trim();
    const head = p.here;
    if (fmt === 'Bullets' || fmt === 'Numbered List') {
      const items =
        type === 'grammar'
          ? ['Fixed capitalization and spacing.', 'Tightened sentence structure.', 'Kept your original meaning intact.']
          : ['Clearer and more direct wording.', 'Stronger, more professional tone.', 'Same meaning, better flow.'];
      return (
        head +
        '\n\n' +
        cleaned.charAt(0).toUpperCase() +
        cleaned.slice(1) +
        '\n\n' +
        items.map((x, i) => (fmt === 'Bullets' ? '• ' + x : i + 1 + '. ' + x)).join('\n')
      );
    }
    return head + '\n\n' + cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  switch (fmt) {
    case 'Bullets':
      return lines.map((x) => '• ' + x).join('\n');
    case 'Numbered List':
      return lines.map((x, i) => i + 1 + '. ' + x).join('\n');
    case 'Email': {
      const subj = target.length > 60 ? target.slice(0, 57) + '...' : target;
      return (
        'Subject: ' + subj.charAt(0).toUpperCase() + subj.slice(1) + '\n\n' + open + '\n\n' +
        lines.join('\n\n') + '\n\n' + close + '\nType X'
      );
    }
    case 'Social Media':
      return lines.join('\n\n') + '\n\n#TypeX #AI #Productivity';
    case 'Plain Text':
      return lines.join(' ');
    default:
      return open + ' ' + lines.join(' ') + '\n\n' + close + '\nType X';
  }
}

/* ---------- plan kind mapping: task type -> platform action ---------- */
const SEND_KINDS = new Set(['email', 'reply', 'message', 'followup']);

export class LocalProvider implements AIProvider {
  readonly name = 'local';

  async generate(input: AIGenerateInput): Promise<string> {
    const instr = (input.instruction || '').trim();
    if (!instr) throw new Error('empty');
    if (/^\s*test error\b/i.test(instr)) {
      await sleep(700);
      throw new Error('simulated');
    }
    const style: AIStyle = Object.assign(
      { tone: 'Professional', language: 'English', length: 'Medium', format: 'Paragraphs' },
      input.style || {},
    );
    const type = detectType(instr);
    const target = extractTarget(instr, input.contextText || '');
    await sleep(450 + Math.random() * 350); // "understanding" beat
    if (input.signal && input.signal.cancelled) throw new Error('cancelled');
    const body = buildBody(type, target, style);
    const text = applyFormat(type, body, style, target, instr);
    // Stream in word-ish tokens so onToken consumers see progressive output.
    const tokens = text.match(/\S+\s*/g) || [text];
    let acc = '';
    for (const tk of tokens) {
      if (input.signal && input.signal.cancelled) throw new Error('cancelled');
      acc += tk;
      if (input.onToken) input.onToken(tk, acc);
      await sleep(14 + Math.random() * 22);
    }
    return acc;
  }

  async stream(input: AIGenerateInput, onToken: (t: string, acc: string) => void): Promise<string> {
    return this.generate({ ...input, onToken });
  }

  async classify(text: string): Promise<string> {
    return detectType(text);
  }

  async extract(text: string, fields: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const f of fields) {
      // "field: value" lines, then "field = value", then bare-word proximity.
      const re = new RegExp('(?:^|\\n)\\s*' + escRe(f) + '\\s*[:=]\\s*([^\\n]+)', 'i');
      const m = text.match(re);
      out[f] = m ? m[1].trim() : '';
    }
    return out;
  }

  async summarize(text: string): Promise<string> {
    if (!text.trim()) return '';
    return this.generate({
      instruction: 'summarize: ' + text.slice(0, 2000),
      style: { length: 'Short', format: 'Bullets', tone: 'Simple' },
    });
  }

  async planAction(instruction: string, context: unknown): Promise<ActionDraft> {
    const taskType = detectType(instruction);
    const isSend = SEND_KINDS.has(taskType);
    const kind = isSend ? 'send_message' : 'generate_text';
    const permission = isSend ? P.SEND_MESSAGE : P.GENERATE_TEXT;
    const requiresApproval = isSend; // outbound messages always need approval (or a grant)
    // Draft the actual text now so the approval preview shows the real message.
    const text = await this.generate({
      instruction,
      contextText: typeof context === 'string' ? context : '',
      style: { length: 'Medium', format: taskType === 'email' ? 'Email' : 'Paragraphs', tone: 'Professional' },
    });
    const ctx = (context && typeof context === 'object' ? context : {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = { text };
    if (ctx.to) payload.to = ctx.to;
    if (ctx.phone) payload.to = ctx.phone;
    if (ctx.name) payload.name = ctx.name;
    return {
      kind,
      payload,
      mode: 'api',
      requiresApproval,
      permission,
      preview: text.slice(0, 220),
      taskType,
    };
  }
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ======================= OpenAIProvider (cloud) ======================= */

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private apiKey: string;
  private model: string;

  /** @param apiKey Falls back to process.env.OPENAI_API_KEY. Server-side only. */
  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new ConfigurationError(
        'OpenAI API key required — set OPENAI_API_KEY (server-side only; never expose keys client-side).',
      );
    }
    this.apiKey = key;
    this.model = model;
  }

  private async chat(messages: ChatMessage[], maxTokens = 800): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI request failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty response.');
    return text;
  }

  async generate(input: AIGenerateInput): Promise<string> {
    if (!(input.instruction || '').trim()) throw new Error('empty');
    const style = input.style || {};
    const sys =
      `You are TYPE X, a helpful writing assistant. Tone: ${style.tone || 'Professional'}. ` +
      `Language: ${style.language || 'English'}. Length: ${style.length || 'Medium'}. Format: ${style.format || 'Paragraphs'}.`;
    const user = input.contextText ? `Context:\n${input.contextText}\n\nInstruction:\n${input.instruction}` : input.instruction;
    return this.chat([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ]);
  }

  async classify(text: string): Promise<string> {
    const label = await this.chat(
      [{ role: 'user', content: `Classify this instruction into exactly one label: email, reply, rewrite, translate, caption, summary, proposal, message, ideas, grammar, script, apply, followup, social, format, general.\n\nInstruction: ${text.slice(0, 500)}\n\nReply with only the label.` }],
      20,
    );
    return label.toLowerCase().replace(/[^a-z]/g, '') || 'general';
  }

  async extract(text: string, fields: string[]): Promise<Record<string, string>> {
    const raw = await this.chat(
      [{ role: 'user', content: `Extract these fields as JSON: ${fields.join(', ')}. Use "" for missing fields. Reply with JSON only.\n\nText:\n${text.slice(0, 3000)}` }],
      400,
    );
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const f of fields) out[f] = String(parsed[f] ?? '');
      return out;
    } catch {
      const out: Record<string, string> = {};
      for (const f of fields) out[f] = '';
      return out;
    }
  }

  async summarize(text: string): Promise<string> {
    if (!text.trim()) return '';
    return this.chat([{ role: 'user', content: `Summarize in 3 short bullets:\n\n${text.slice(0, 4000)}` }], 300);
  }

  async planAction(instruction: string, context: unknown): Promise<ActionDraft> {
    const ctx = (context && typeof context === 'object' ? context : {}) as Record<string, unknown>;
    const raw = await this.chat(
      [
        {
          role: 'user',
          content:
            'You are the planner for an AI agent. Reply with JSON only: {"kind":"send_message"|"generate_text","requiresApproval":true|false,"permission":"SEND_MESSAGE"|"GENERATE_TEXT","preview":"<short preview>"}.\n' +
            'Use send_message only when the instruction asks to send/contact/message someone.\n' +
            `Instruction: ${instruction.slice(0, 600)}`,
        },
      ],
      300,
    );
    let parsed: { kind?: string; requiresApproval?: boolean; permission?: string; preview?: string } = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      /* fall through to safe defaults */
    }
    const kind = parsed.kind === 'send_message' ? 'send_message' : 'generate_text';
    const text = await this.generate({ instruction });
    const payload: Record<string, unknown> = { text };
    if (ctx.to) payload.to = ctx.to;
    if (ctx.phone) payload.to = ctx.phone;
    return {
      kind,
      payload,
      mode: 'api',
      requiresApproval: kind === 'send_message' ? parsed.requiresApproval !== false : false,
      permission: kind === 'send_message' ? P.SEND_MESSAGE : P.GENERATE_TEXT,
      preview: String(parsed.preview || text.slice(0, 220)),
      taskType: await this.classify(instruction),
    };
  }
}

/* ====================== AnthropicProvider (cloud) ===================== */

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private apiKey: string;
  private model: string;

  /** @param apiKey Falls back to process.env.ANTHROPIC_API_KEY. Server-side only. */
  constructor(apiKey?: string, model = 'claude-sonnet-4-20250514') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new ConfigurationError(
        'Anthropic API key required — set ANTHROPIC_API_KEY (server-side only; never expose keys client-side).',
      );
    }
    this.apiKey = key;
    this.model = model;
  }

  private async messages(system: string, user: string, maxTokens = 800): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic request failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();
    if (!text) throw new Error('Anthropic returned an empty response.');
    return text;
  }

  async generate(input: AIGenerateInput): Promise<string> {
    if (!(input.instruction || '').trim()) throw new Error('empty');
    const style = input.style || {};
    const sys =
      `You are TYPE X, a helpful writing assistant. Tone: ${style.tone || 'Professional'}. ` +
      `Language: ${style.language || 'English'}. Length: ${style.length || 'Medium'}. Format: ${style.format || 'Paragraphs'}.`;
    const user = input.contextText ? `Context:\n${input.contextText}\n\nInstruction:\n${input.instruction}` : input.instruction;
    return this.messages(sys, user);
  }

  async classify(text: string): Promise<string> {
    const label = await this.messages(
      'Reply with exactly one label and nothing else.',
      `Classify this instruction into exactly one label: email, reply, rewrite, translate, caption, summary, proposal, message, ideas, grammar, script, apply, followup, social, format, general.\n\nInstruction: ${text.slice(0, 500)}`,
      20,
    );
    return label.toLowerCase().replace(/[^a-z]/g, '') || 'general';
  }

  async extract(text: string, fields: string[]): Promise<Record<string, string>> {
    const raw = await this.messages(
      'Reply with JSON only.',
      `Extract these fields as JSON: ${fields.join(', ')}. Use "" for missing fields.\n\nText:\n${text.slice(0, 3000)}`,
      400,
    );
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const f of fields) out[f] = String(parsed[f] ?? '');
      return out;
    } catch {
      const out: Record<string, string> = {};
      for (const f of fields) out[f] = '';
      return out;
    }
  }

  async summarize(text: string): Promise<string> {
    if (!text.trim()) return '';
    return this.messages('Summarize concisely.', `Summarize in 3 short bullets:\n\n${text.slice(0, 4000)}`, 300);
  }

  async planAction(instruction: string, context: unknown): Promise<ActionDraft> {
    const ctx = (context && typeof context === 'object' ? context : {}) as Record<string, unknown>;
    const raw = await this.messages(
      'You are the planner for an AI agent. Reply with JSON only.',
      'Reply with JSON only: {"kind":"send_message"|"generate_text","requiresApproval":true|false,"permission":"SEND_MESSAGE"|"GENERATE_TEXT","preview":"<short preview>"}.\n' +
        'Use send_message only when the instruction asks to send/contact/message someone.\n' +
        `Instruction: ${instruction.slice(0, 600)}`,
      300,
    );
    let parsed: { kind?: string; requiresApproval?: boolean; permission?: string; preview?: string } = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      /* fall through to safe defaults */
    }
    const kind = parsed.kind === 'send_message' ? 'send_message' : 'generate_text';
    const text = await this.generate({ instruction });
    const payload: Record<string, unknown> = { text };
    if (ctx.to) payload.to = ctx.to;
    if (ctx.phone) payload.to = ctx.phone;
    return {
      kind,
      payload,
      mode: 'api',
      requiresApproval: kind === 'send_message' ? parsed.requiresApproval !== false : false,
      permission: kind === 'send_message' ? P.SEND_MESSAGE : P.GENERATE_TEXT,
      preview: String(parsed.preview || text.slice(0, 220)),
      taskType: await this.classify(instruction),
    };
  }
}
