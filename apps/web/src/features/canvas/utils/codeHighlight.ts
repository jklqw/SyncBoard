export type CodeTokenTone =
  'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'type';

export interface CodeToken {
  text: string;
  tone: CodeTokenTone;
}

/** VS Code Dark+ inspired colors that stay readable on the charcoal code surface. */
export const CODE_TOKEN_COLORS: Record<CodeTokenTone, string> = {
  plain: '#D4D4D8',
  keyword: '#C586C0',
  string: '#CE9178',
  comment: '#6A9955',
  number: '#B5CEA8',
  function: '#DCDCAA',
  type: '#4EC9B0',
};

const GENERIC_KEYWORDS = [
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'yield',
];

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  typescript: ['declare', 'enum', 'implements', 'keyof', 'readonly', 'satisfies'],
  javascript: ['debugger', 'with'],
  python: [
    'and',
    'def',
    'elif',
    'except',
    'finally',
    'global',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'with',
    'yield',
  ],
  go: ['chan', 'defer', 'func', 'go', 'map', 'package', 'range', 'select', 'struct', 'var'],
  rust: [
    'crate',
    'fn',
    'impl',
    'let',
    'mod',
    'move',
    'mut',
    'pub',
    'ref',
    'struct',
    'trait',
    'use',
    'where',
  ],
  java: [
    'abstract',
    'boolean',
    'byte',
    'char',
    'double',
    'final',
    'float',
    'int',
    'long',
    'package',
    'short',
  ],
  c: [
    'bool',
    'char',
    'double',
    'float',
    'int',
    'long',
    'short',
    'sizeof',
    'struct',
    'unsigned',
    'void',
  ],
  cpp: [
    'auto',
    'bool',
    'char',
    'double',
    'float',
    'int',
    'long',
    'namespace',
    'short',
    'sizeof',
    'struct',
    'template',
    'typename',
    'unsigned',
    'using',
    'virtual',
  ],
  csharp: [
    'abstract',
    'bool',
    'byte',
    'char',
    'double',
    'float',
    'int',
    'long',
    'namespace',
    'object',
    'override',
    'params',
    'short',
    'string',
    'using',
    'virtual',
  ],
  php: ['array', 'echo', 'elseif', 'endif', 'function', 'global', 'include', 'require', 'return'],
  ruby: [
    'begin',
    'def',
    'do',
    'elsif',
    'end',
    'module',
    'require',
    'rescue',
    'self',
    'unless',
    'until',
  ],
  sql: [
    'and',
    'as',
    'asc',
    'by',
    'create',
    'delete',
    'desc',
    'distinct',
    'drop',
    'from',
    'group',
    'having',
    'insert',
    'into',
    'join',
    'left',
    'limit',
    'not',
    'null',
    'on',
    'or',
    'order',
    'select',
    'set',
    'table',
    'update',
    'values',
    'where',
  ],
  bash: [
    'case',
    'do',
    'done',
    'elif',
    'esac',
    'fi',
    'for',
    'function',
    'if',
    'in',
    'local',
    'then',
    'while',
  ],
  json: ['false', 'null', 'true'],
  yaml: ['false', 'null', 'true'],
  markdown: [],
  plaintext: [],
};

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  golang: 'go',
  rs: 'rust',
  'c++': 'cpp',
  cs: 'csharp',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  text: 'plaintext',
};

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

/**
 * Small dependency-free tokenizer for on-canvas snippets and the overlay editor.
 * It favors predictable, fast highlighting over full language grammars.
 */
export function tokenizeCode(source: string, language = 'plaintext'): CodeToken[][] {
  const lang = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  if (lang === 'plaintext') {
    return source.split('\n').map((line) => [{ text: line, tone: 'plain' as const }]);
  }
  const keywords = new Set([...GENERIC_KEYWORDS, ...(LANGUAGE_KEYWORDS[lang] ?? [])]);
  const hashComments = ['python', 'bash', 'ruby', 'yaml'].includes(lang);
  const dashComments = lang === 'sql' || lang === 'lua';
  const blockComments = [
    'typescript',
    'javascript',
    'java',
    'c',
    'cpp',
    'csharp',
    'go',
    'rust',
    'php',
    'sql',
  ].includes(lang);

  let inBlockComment = false;

  return source.split('\n').map((line) => {
    const tokens: CodeToken[] = [];
    let plain = '';
    let index = 0;

    const flushPlain = (): void => {
      if (plain) tokens.push({ text: plain, tone: 'plain' });
      plain = '';
    };
    const push = (text: string, tone: CodeTokenTone): void => {
      if (text) tokens.push({ text, tone });
    };

    while (index < line.length) {
      if (inBlockComment) {
        const end = line.indexOf('*/', index);
        if (end === -1) {
          push(line.slice(index), 'comment');
          index = line.length;
          break;
        }
        push(line.slice(index, end + 2), 'comment');
        index = end + 2;
        inBlockComment = false;
        continue;
      }

      const rest = line.slice(index);
      if (blockComments && rest.startsWith('/*')) {
        flushPlain();
        inBlockComment = true;
        push('/*', 'comment');
        index += 2;
        continue;
      }
      if (rest.startsWith('//') || (dashComments && rest.startsWith('--'))) {
        flushPlain();
        push(rest, 'comment');
        break;
      }
      if (hashComments && rest.startsWith('#')) {
        flushPlain();
        push(rest, 'comment');
        break;
      }

      const char = line.charAt(index);
      if (char === '"' || char === "'" || char === '`') {
        flushPlain();
        let end = index + 1;
        while (end < line.length) {
          if (line.charAt(end) === '\\') {
            end += 2;
            continue;
          }
          if (line.charAt(end) === char) {
            end += 1;
            break;
          }
          end += 1;
        }
        push(line.slice(index, Math.min(end, line.length)), 'string');
        index = Math.min(end, line.length);
        continue;
      }

      if (/[0-9]/.test(char)) {
        flushPlain();
        let end = index + 1;
        while (end < line.length && /[0-9a-fA-FxX._]/.test(line.charAt(end))) end += 1;
        push(line.slice(index, end), 'number');
        index = end;
        continue;
      }

      if (isIdentifierStart(char)) {
        flushPlain();
        let end = index + 1;
        while (end < line.length && isIdentifierPart(line.charAt(end))) end += 1;
        const word = line.slice(index, end);
        let lookahead = end;
        while (lookahead < line.length && /\s/.test(line.charAt(lookahead))) lookahead += 1;
        let tone: CodeTokenTone = 'plain';
        if (keywords.has(word)) tone = 'keyword';
        else if (line[lookahead] === '(') tone = 'function';
        else if (/^[A-Z]/.test(word)) tone = 'type';
        push(word, tone);
        index = end;
        continue;
      }

      plain += char;
      index += 1;
    }

    flushPlain();
    return tokens;
  });
}
