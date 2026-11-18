const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ClassicLevel } = require('classic-level');

function makeId(seed) {
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 16);
}

const BUILDER_ID = 'tfcoaBuilder0000';

const DEFAULT_STATS = {
  coreVersion: '14.370',
  systemId: 'ose',
  systemVersion: '3.3.0',
  createdTime: 1795003581160,
  modifiedTime: 1795003581162,
  lastModifiedBy: BUILDER_ID,
  compendiumSource: null,
  duplicateSource: null,
  exportSource: null
};

const PACKS = [
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
        doc._stats = { ...DEFAULT_STATS, ...(doc._stats || {}) };

        if (pack.prefix === 'journals') {
          doc.folder = null;
          doc.categories = Array.isArray(doc.categories) ? doc.categories : [];
          doc.sort = count * 100000;
          doc.ownership = { default: 0, [BUILDER_ID]: 3 };
          doc.flags = doc.flags || {};
        }

        if (pack.subKey && Array.isArray(doc[pack.subKey])) {
          const subIds = [];
          for (let idx = 0; idx < doc[pack.subKey].length; idx++) {
            const sub = doc[pack.subKey][idx];
            const subId = sub._id || makeId(`${pack.name}:${file}:${pack.subKey}:${idx}`);
            sub._id = subId;

            if (pack.subPrefix === 'journals.pages') {
              const cleanPage = {
                _id: subId,
                name: sub.name || `Page ${idx + 1}`,
                type: 'text',
                category: null,
                title: {
                  show: sub.title?.show ?? true,
                  level: sub.title?.level ?? 1
                },
                image: {},
                text: {
                  format: 1,
                  content: sub.text?.content || ''
                },
                video: {
                  controls: true,
                  volume: 0.5
                },
                src: null,
                system: {},
                sort: idx * 100000,
                ownership: { default: -1 },
                flags: {},
                _stats: { ...DEFAULT_STATS }
              };
              await db.put(`!${pack.subPrefix}!${docId}.${subId}`, cleanPage);
            } else {
              await db.put(`!${pack.subPrefix}!${docId}.${subId}`, sub);
            }

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