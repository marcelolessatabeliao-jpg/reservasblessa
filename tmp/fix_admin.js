const fs = require('fs');

const src = 'src/pages/Admin.tsx';
const dst = 'src/pages/Admin_new.tsx';

const fixes = {
  378: [
    "b.status === 'paid') {",
    "b.status === 'paid' || b.status === 'pending') {"
  ],
  2075: [
    "Meia/Solidário",
    "Meia-Entrada"
  ],
  2076: [
    "{ k: 'adults_free', l: 'Especial (PCD/Idoso)', p: 'Grátis' },",
    "{ k: 'is_teacher', l: 'Professor', p: 'R$ 25' },\r\n                                 { k: 'is_student', l: 'Estudante', p: 'R$ 25' },\r\n                                 { k: 'is_server', l: 'Servidor', p: 'R$ 25' },\r\n                                 { k: 'is_donor', l: 'Doador Sangue', p: 'R$ 25' },\r\n                                 { k: 'is_solidarity', l: 'Adulto Solidário', p: 'R$ 25' },\r\n                                 { k: 'is_pcd', l: 'PCD', p: 'Grátis' },\r\n                                 { k: 'is_tea', l: 'TEA', p: 'Grátis' },\r\n                                 { k: 'is_senior', l: 'Idoso (60+)', p: 'Grátis' },\r\n                                 { k: 'is_birthday', l: 'Aniversariante', p: 'Grátis' },"
  ]
};

let lineNum = 0;
let buffer = '';
const inStream = fs.createReadStream(src, { encoding: 'utf8', highWaterMark: 1024 });
const outStream = fs.createWriteStream(dst, { encoding: 'utf8' });

inStream.on('data', chunk => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    lineNum++;
    let out = line;
    if (fixes[lineNum]) {
      const [o, n] = fixes[lineNum];
      if (out.includes(o)) { out = out.replace(o, n); console.log('Fixed line ' + lineNum); }
    }
    outStream.write(out + '\n');
  }
});

inStream.on('end', () => {
  if (buffer) { lineNum++; outStream.write(buffer); }
  outStream.end(() => {
    fs.renameSync(dst, src);
    console.log('Done. Lines: ' + lineNum);
  });
});
inStream.on('error', e => { console.error('ERR:', e.message); });
