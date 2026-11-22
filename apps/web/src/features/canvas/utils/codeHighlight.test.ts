import { describe, expect, it } from 'vitest';
import { CODE_TOKEN_COLORS, tokenizeCode } from './codeHighlight';

describe('tokenizeCode', () => {
  it('colors TypeScript keywords, numbers, and line comments', () => {
    const line = tokenizeCode('const answer = 42; // computed', 'typescript')[0] ?? [];
    const byText = new Map(line.map((token) => [token.text, token.tone]));

    expect(byText.get('const')).toBe('keyword');
    expect(byText.get('42')).toBe('number');
    expect(byText.get('// computed')).toBe('comment');
  });

  it('respects language-specific comment syntax', () => {
    const line = tokenizeCode('answer = 42  # computed', 'python')[0] ?? [];
    expect(line.some((token) => token.text === '# computed' && token.tone === 'comment')).toBe(
      true,
    );
  });

  it('leaves plaintext uncolored', () => {
    const line = tokenizeCode('const answer = 42', 'plaintext')[0] ?? [];
    expect(line.every((token) => token.tone === 'plain')).toBe(true);
    expect(CODE_TOKEN_COLORS.plain).toBeTruthy();
  });
});
