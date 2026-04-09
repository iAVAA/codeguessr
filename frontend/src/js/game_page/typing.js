/**
 * CodeGuessr - typing.js
 * Animazione di digitazione per la decorazione di codice in lobby
 */

const SNIPPETS = [
  {
    title: 'App.js',
    tokens: [
      { t: 'function ', c: 'kw' }, { t: 'fizzBuzz', c: 'fn' }, { t: '(' },
      { t: 'n', c: 'vbl' }, { t: ') {\n  ' }, { t: 'return ', c: 'cf' },
      { t: 'Array', c: 'ty' }, { t: '.' }, { t: 'from', c: 'fn' },
      { t: '({ ' }, { t: 'length', c: 'vbl' }, { t: ': ' }, { t: 'n', c: 'vbl' },
      { t: ' }, (' }, { t: '_', c: 'vbl' }, { t: ', ' }, { t: 'i', c: 'vbl' },
      { t: ') ' }, { t: '=>', c: 'cf' }, { t: ' ' }, { t: 'i', c: 'vbl' },
      { t: ' + ' }, { t: '1', c: 'num' }, { t: ')\n    .' }, { t: 'map', c: 'fn' },
      { t: '(' }, { t: 'x', c: 'vbl' }, { t: ' ' }, { t: '=>', c: 'cf' },
      { t: ' {\n      ' }, { t: 'if ', c: 'cf' }, { t: '(' }, { t: 'x', c: 'vbl' },
      { t: ' % ' }, { t: '15', c: 'num' }, { t: ' === ' }, { t: '0', c: 'num' },
      { t: ') ' }, { t: 'return ', c: 'cf' }, { t: '"FizzBuzz"', c: 'str' },
      { t: ';\n      ' }, { t: 'if ', c: 'cf' }, { t: '(' }, { t: 'x', c: 'vbl' },
      { t: ' % ' }, { t: '3', c: 'num' }, { t: ' === ' }, { t: '0', c: 'num' },
      { t: ') ' }, { t: 'return ', c: 'cf' }, { t: '"Fizz"', c: 'str' },
      { t: ';\n      ' }, { t: 'if ', c: 'cf' }, { t: '(' }, { t: 'x', c: 'vbl' },
      { t: ' % ' }, { t: '5', c: 'num' }, { t: ' === ' }, { t: '0', c: 'num' },
      { t: ') ' }, { t: 'return ', c: 'cf' }, { t: '"Buzz"', c: 'str' },
      { t: ';\n      ' }, { t: 'return ', c: 'cf' }, { t: 'x', c: 'vbl' },
      { t: ';\n    });\n}' },
    ],
  },
  {
    title: 'api.py',
    tokens: [
      { t: 'def ', c: 'kw' }, { t: 'fetch_data', c: 'fn' }, { t: '(' },
      { t: 'url', c: 'vbl' }, { t: '):\n  ' }, { t: 'response', c: 'vbl' },
      { t: ' = ' }, { t: 'requests', c: 'vbl' }, { t: '.' },
      { t: 'get', c: 'fn' }, { t: '(' }, { t: 'url', c: 'vbl' }, { t: ')\n  ' },
      { t: 'if ', c: 'cf' }, { t: 'response', c: 'vbl' }, { t: '.' },
      { t: 'status_code', c: 'vbl' }, { t: ' == ' }, { t: '200', c: 'num' },
      { t: ':\n    ' }, { t: 'return ', c: 'cf' }, { t: 'response', c: 'vbl' },
      { t: '.' }, { t: 'json', c: 'fn' }, { t: '()' },
    ],
  },
  {
    title: 'utils.js',
    tokens: [
      { t: 'const ', c: 'kw' }, { t: 'debounce', c: 'fn' }, { t: ' = (' },
      { t: 'fn', c: 'vbl' }, { t: ', ' }, { t: 'delay', c: 'vbl' },
      { t: ') ' }, { t: '=>', c: 'cf' }, { t: ' {\n  ' }, { t: 'let ', c: 'kw' },
      { t: 'timer', c: 'vbl' }, { t: ';\n  ' }, { t: 'return ', c: 'cf' },
      { t: '(...' }, { t: 'args', c: 'vbl' }, { t: ') ' }, { t: '=>', c: 'cf' },
      { t: ' {\n    ' }, { t: 'clearTimeout', c: 'fn' }, { t: '(' },
      { t: 'timer', c: 'vbl' }, { t: ');\n    ' }, { t: 'timer', c: 'vbl' },
      { t: ' = ' }, { t: 'setTimeout', c: 'fn' }, { t: '(() ' },
      { t: '=>', c: 'cf' }, { t: ' ' }, { t: 'fn', c: 'fn' }, { t: '(...' },
      { t: 'args', c: 'vbl' }, { t: '), ' }, { t: 'delay', c: 'vbl' },
      { t: ');\n  };\n}' },
    ],
  },
  {
    title: 'math.go',
    tokens: [
      { t: 'func ', c: 'kw' }, { t: 'Max', c: 'fn' }, { t: '(' },
      { t: 'a', c: 'vbl' }, { t: ', ' }, { t: 'b', c: 'vbl' }, { t: ' ' },
      { t: 'int', c: 'ty' }, { t: ') ' }, { t: 'int', c: 'ty' }, { t: ' {\n  ' },
      { t: 'if ', c: 'cf' }, { t: 'a', c: 'vbl' }, { t: ' > ' },
      { t: 'b', c: 'vbl' }, { t: ' {\n    ' }, { t: 'return ', c: 'cf' },
      { t: 'a', c: 'vbl' }, { t: '\n  }\n  ' }, { t: 'return ', c: 'cf' },
      { t: 'b', c: 'vbl' }, { t: '\n}' },
    ],
  },
  {
    title: 'main.rs',
    tokens: [
      { t: 'fn ', c: 'kw' }, { t: 'fib', c: 'fn' }, { t: '(' },
      { t: 'n', c: 'vbl' }, { t: ': ' }, { t: 'u32', c: 'ty' },
      { t: ') -> ' }, { t: 'u32', c: 'ty' }, { t: ' {\n  ' },
      { t: 'match ', c: 'cf' }, { t: 'n', c: 'vbl' }, { t: ' {\n    ' },
      { t: '0', c: 'num' }, { t: ' => ' }, { t: '0', c: 'num' }, { t: ',\n    ' },
      { t: '1', c: 'num' }, { t: ' => ' }, { t: '1', c: 'num' }, { t: ',\n    ' },
      { t: '_', c: 'kw' }, { t: ' => ' }, { t: 'fib', c: 'fn' }, { t: '(' },
      { t: 'n', c: 'vbl' }, { t: ' - ' }, { t: '1', c: 'num' }, { t: ') + ' },
      { t: 'fib', c: 'fn' }, { t: '(' }, { t: 'n', c: 'vbl' }, { t: ' - ' },
      { t: '2', c: 'num' }, { t: ')\n  }\n}' },
    ],
  },
];

// ─── Typing Engine ───────────────────────────────────────────────────────────

function createSpan(token) {
  const span = document.createElement('span');
  if (token.c) span.className = token.c;
  return span;
}

function playSnippet(container, snippets, index) {
  container.innerHTML = '';
  container.classList.add('typing-active');

  const { title, tokens } = snippets[index];

  const titleEl = document.createElement('div');
  titleEl.className = 'mac-window-title';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  let tokenIdx = 0;
  let charIdx = 0;
  let currentSpan = null;

  function typeNext() {
    if (tokenIdx >= tokens.length) {
      container.classList.remove('typing-active');
      setTimeout(() => {
        playSnippet(container, snippets, (index + 1) % snippets.length);
      }, 5000);
      return;
    }

    const token = tokens[tokenIdx];

    if (charIdx === 0) {
      currentSpan = createSpan(token);
      container.appendChild(currentSpan);
    }

    currentSpan.textContent += token.t[charIdx];
    charIdx++;

    if (charIdx >= token.t.length) {
      tokenIdx++;
      charIdx = 0;
    }

    // Variabilità realistica nella velocità di digitazione
    const delay = Math.random() * 40 + 20 + (token.t[charIdx - 1] === ' ' ? 30 : 0);
    setTimeout(typeNext, delay);
  }

  setTimeout(typeNext, 800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initTypingAnimation() {
  const container = document.querySelector('.code-decoration');
  if (!container) return;
  playSnippet(container, SNIPPETS, 0);
}

initTypingAnimation();
