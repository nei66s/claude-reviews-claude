const fs = require('fs');
const content = fs.readFileSync('app/api/chat/stream/route.ts', 'utf8');
let open = 0;
let close = 0;
let i = 0;
while (i < content.length) {
  let c = content[i];
  if (c === '"' || c === "'" || c === '`') {
    let q = c;
    i++;
    while (i < content.length && (content[i] !== q || content[i - 1] === '\\')) i++;
  } else if (c === '/' && content[i + 1] === '/') {
    while (i < content.length && content[i] !== '\n') i++;
  } else if (c === '/' && content[i + 1] === '*') {
    i += 2;
    while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
    i++;
  } else if (c === '{') {
    open++;
  } else if (c === '}') {
    close++;
  }
  let line = content.substring(0, i).split('\n').length;
  if (line === 1430 && content[i] === '\n') console.log('Line 1430 Diff:', open - close);
  i++;
}
console.log('Open:', open);
console.log('Close:', close);
console.log('Diff:', open - close);

