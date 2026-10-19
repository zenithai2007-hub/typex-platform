import { describe, it, expect } from 'vitest';
import { LocalProvider, ConfigurationError, OpenAIProvider, AnthropicProvider, detectType, extractTarget } from '@typex/ai';
import { Permission } from '@typex/types';

describe('LocalProvider — ported local engine', () => {
  const ai = new LocalProvider();

  it('classify detects task types', async () => {
    expect(await ai.classify('write an email about pricing')).toBe('email');
    expect(await ai.classify('reply to the customer about pricing')).toBe('reply');
    expect(await ai.classify('summarize this long report for me')).toBe('summary');
    expect(await ai.classify('translate hello friend')).toBe('translate');
  });

  it('detectType / extractTarget helpers are exported and faithful', () => {
    expect(detectType('draft a proposal for the client')).toBe('proposal');
    expect(extractTarget('write an email about "Q3 launch"', '')).toBe('Q3 launch');
  });

  it('generates Roman Urdu without template placeholders', async () => {
    const text = await ai.generate({
      instruction: 'write a message about the product launch',
      style: { language: 'Roman Urdu', length: 'Short', format: 'Plain Text' },
    });
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toContain('{t}');
    expect(text).not.toContain('{team}');
  });

  it('generates Urdu', async () => {
    const text = await ai.generate({
      instruction: 'write a reply about the order',
      style: { language: 'Urdu', length: 'Short', format: 'Plain Text' },
    });
    expect(text.length).toBeGreaterThan(10);
    expect(text).not.toContain('{t}');
  });

  it('formats as email with subject line', async () => {
    const text = await ai.generate({
      instruction: 'write an email about the new pricing plan',
      style: { format: 'Email', length: 'Short' },
    });
    expect(text).toContain('Subject:');
  });

  it('translates via the dictionary with the honest v1 note', async () => {
    const text = await ai.generate({
      instruction: 'translate hello friend',
      style: { language: 'Roman Urdu' },
    });
    expect(text).toContain('salam');
    expect(text).toContain('dost');
    expect(text).toContain('v1 demo dictionary');
  });

  it('streams tokens through onToken', async () => {
    const seen: string[] = [];
    const text = await ai.generate({
      instruction: 'write a caption about the launch',
      style: { length: 'Short', format: 'Plain Text' },
      onToken: (t) => seen.push(t),
    });
    expect(seen.length).toBeGreaterThan(3);
    expect(seen.join('')).toBe(text);
  });

  it('rejects empty instructions', async () => {
    await expect(ai.generate({ instruction: '   ' })).rejects.toThrow('empty');
  });

  it('planAction: reply → send_message with approval + SEND_MESSAGE', async () => {
    const draft = await ai.planAction('reply to the customer about pricing', { to: '923001234567' });
    expect(draft.kind).toBe('send_message');
    expect(draft.requiresApproval).toBe(true);
    expect(draft.permission).toBe(Permission.SEND_MESSAGE);
    expect(draft.payload.to).toBe('923001234567');
    expect(String(draft.payload.text).length).toBeGreaterThan(20);
    expect(draft.preview.length).toBeGreaterThan(0);
    expect(draft.taskType).toBe('reply');
  });

  it('planAction: summarize → generate_text without approval', async () => {
    const draft = await ai.planAction('summarize the meeting notes', {});
    expect(draft.kind).toBe('generate_text');
    expect(draft.requiresApproval).toBe(false);
    expect(draft.permission).toBe(Permission.GENERATE_TEXT);
  });

  it('summarize returns short bullets', async () => {
    const s = await ai.summarize('The quarterly review covered revenue growth of 20 percent, new hires in support, and a delayed launch.');
    expect(s).toContain('•');
  });
});

describe('cloud providers require keys', () => {
  it('OpenAIProvider throws ConfigurationError without a key', () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => new OpenAIProvider()).toThrow(ConfigurationError);
      expect(() => new OpenAIProvider()).toThrow(/OPENAI_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it('AnthropicProvider throws ConfigurationError without a key', () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => new AnthropicProvider()).toThrow(ConfigurationError);
      expect(() => new AnthropicProvider()).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('constructors accept an explicit key (no network call)', () => {
    expect(new OpenAIProvider('sk-test').name).toBe('openai');
    expect(new AnthropicProvider('sk-ant-test').name).toBe('anthropic');
  });
});
