const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function makeId(seed) {
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 16);
}

const DEFAULT_STATS = {
  coreVersion: '14.370',
  systemId: 'ose',
  systemVersion: '3.3.0',
  createdTime: Date.now(),
  modifiedTime: Date.now(),
  lastModifiedBy: 'tfcoaBuilder00000',
  compendiumSource: null,
  duplicateSource: null,
  exportSource: null
};

const PACKS = [
  { name: 'archaia-journals', prefix: 'journals', subKey: 'pages',   subPrefix: 'journals.pages' },
  { name: 'archaia-actors',   prefix: 'actors',   subKey: 'items',   subPrefix: 'actors.items' },
  { name: 'archaia-tables',   prefix: 'tables',   subKey: 'results', subPrefix: 'tables.results' },
  { name: 'archaia-items',    prefix: 'items',    subKey: null,      subPrefix: null }
];

const tempDir = path.join(__dirname, '..', '.tmp-src');
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

for (const pack of PACKS) {
  const srcFolder = path.join(__dirname, '..', 'src', pack.name);
  const outTempFolder = path.join(tempDir, pack.name);
  const outPackFolder = path.join(__dirname, '..', 'packs', pack.name);

  fs.mkdirSync(outTempFolder, { recursive: true });
  if (fs.existsSync(outPackFolder)) fs.rmSync(outPackFolder, { recursive: true, force: true });

  if (!fs.existsSync(srcFolder)) continue;

  const files = fs.readdirSync(srcFolder).filter(f => f.endsWith('.json'));
  let count = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(srcFolder, file), 'utf8');
    const doc = JSON.parse(raw);

    const docId = doc._id || makeId(`${pack.name}:${file}`);
    doc._id = docId;
    doc._key = `!${pack.prefix}!${docId}`;
    doc._stats = doc._stats || { ...DEFAULT_STATS };

    if (pack.prefix === 'journals') {
      doc.folder = null;
      doc.categories = doc.categories || [];
      doc.sort = (count + 1) * 100000;
      doc.ownership = doc.ownership || { default: 0 };
      doc.flags = doc.flags || {};
    }

    if (pack.subKey && Array.isArray(doc[pack.subKey])) {
      doc[pack.subKey] = doc[pack.subKey].map((sub, idx) => {
        const subId = sub._id || makeId(`${pack.name}:${file}:${pack.subKey}:${idx}`);
        const hydratedSub = {
          ...sub,
          _id: subId,
          _key: `!${pack.subPrefix}!${docId}.${subId}`
        };

        if (pack.subPrefix === 'journals.pages') {
          hydratedSub.type = hydratedSub.type || 'text';
          hydratedSub.category = null;
          hydratedSub.title = {
            show: hydratedSub.title?.show ?? true,
            level: hydratedSub.title?.level ?? 1
          };
          hydratedSub.image = hydratedSub.image || {};
          hydratedSub.text = {
            format: 1,
            content: hydratedSub.text?.content || '',
            markdown: ''
          };
          hydratedSub.video = hydratedSub.video || { controls: true, volume: 0.5 };
          hydratedSub.src = null;
          hydratedSub.system = hydratedSub.system || {};
          hydratedSub.sort = (idx + 1) * 100000;
          hydratedSub.ownership = hydratedSub.ownership || { default: -1 };
          hydratedSub.flags = hydratedSub.flags || {};
          hydratedSub._stats = hydratedSub._stats || { ...DEFAULT_STATS };
        }

        return hydratedSub;
      });
    }

    fs.writeFileSync(path.join(outTempFolder, file), JSON.stringify(doc, null, 2));
    count++;
  }

  console.log(`Empacotando ${pack.name} (${count} arquivos)...`);
  execSync(
    `npx fvtt package pack ${pack.name} --type Module --id tfcoa --in "${outTempFolder}" --out "${outPackFolder}"`,
    { stdio: 'inherit' }
  );
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('[OK] Todos os compêndios compilados com a CLI oficial do Foundry!');