const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ClassicLevel } = require('classic-level');

function makeId(seed) {
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 16);
}

const PACKS = [
  { name: 'archaia-journals', prefix: 'journals', subKey: 'pages',   subPrefix: 'journals.pages' },
  { name: 'archaia-actors',   prefix: 'actors',   subKey: 'items',   subPrefix: 'actors.items' },
  { name: 'archaia-tables',   prefix: 'tables',   subKey: 'results', subPrefix: 'tables.results' },
  { name: 'archaia-items',    prefix: 'items',    subKey: null,      subPrefix: null }
];

async function build() {
  for (const pack of PACKS) {
    const srcFolder = path.join(__dirname, '..', 'src', pack.name);
    const outPackFolder = path.join(__dirname, '..', 'packs', pack.name);

    if (fs.existsSync(outPackFolder)) {
      fs.rmSync(outPackFolder, { recursive: true, force: true });
    }
    fs.mkdirSync(outPackFolder, { recursive: true });

    const db = new ClassicLevel(outPackFolder, { keyEncoding: 'utf8', valueEncoding: 'json' });
    await db.open();

    if (fs.existsSync(srcFolder)) {
      const files = fs.readdirSync(srcFolder).filter(f => f.endsWith('.json'));
      let count = 0;

      for (const file of files) {
        const raw = fs.readFileSync(path.join(srcFolder, file), 'utf8');
        const doc = JSON.parse(raw);

        const docId = doc._id || makeId(`${pack.name}:${file}`);
        doc._id = docId;

        if (pack.prefix === 'journals') {
          doc.folder = null;
          doc.sort = (count + 1) * 100000;
          doc.ownership = doc.ownership || { default: 0 };
          doc.flags = doc.flags || {};
        }

        if (pack.subKey && Array.isArray(doc[pack.subKey])) {
          const subIds = [];
          for (let idx = 0; idx < doc[pack.subKey].length; idx++) {
            const sub = doc[pack.subKey][idx];
            const subId = sub._id || makeId(`${pack.name}:${file}:${pack.subKey}:${idx}`);
            sub._id = subId;

            if (pack.subPrefix === 'journals.pages') {
              sub.type = sub.type || 'text';
              sub.title = {
                show: sub.title?.show ?? true,
                level: sub.title?.level ?? 1
              };
              sub.image = sub.image || {};
              sub.text = {
                format: 1,
                content: sub.text?.content || '',
                markdown: ''
              };
              sub.video = sub.video || { controls: true, volume: 0.5 };
              sub.src = null;
              sub.system = sub.system || {};
              sub.sort = (idx + 1) * 100000;
              sub.ownership = sub.ownership || { default: -1 };
              sub.flags = sub.flags || {};
            }

            await db.put(`!${pack.subPrefix}!${docId}.${subId}`, sub);
            subIds.push(subId);
          }
          doc[pack.subKey] = subIds;
        }

        await db.put(`!${pack.prefix}!${docId}`, doc);
        count++;
      }

      console.log(`[OK] ${pack.name}: ${count} documentos gravados no LevelDB.`);
    }

    await db.close();
  }
}

build().catch(err => {
  console.error('Erro ao compilar compêndios:', err);
  process.exit(1);
});