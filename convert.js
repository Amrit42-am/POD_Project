const fs = require('fs');

function htmlToJsx(html) {
  return html
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/<!doctype html>/i, '')
    .replace(/<html[^>]*>[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*<\/html>/i, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img([^>]+)>/g, (m, p) => `<img${p} />`)
    .replace(/<input([^>]+)>/g, (m, p) => {
      if (p.endsWith('/')) return m;
      return `<input${p} />`;
    })
    .replace(/<br>/g, '<br />')
    .replace(/<hr>/g, '<hr />')
    .replace(/hidden/g, 'hidden={true}')
    .replace(/required/g, 'required={true}')
    .replace(/readonly/g, 'readOnly={true}')
    .replace(/disabled/g, 'disabled={true}')
    .replace(/style="([^"]*)"/g, '');
}

const html = fs.readFileSync('public/index.html', 'utf8');
const jsxBody = htmlToJsx(html);
console.log(jsxBody);
