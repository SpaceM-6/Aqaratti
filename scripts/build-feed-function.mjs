// يجمع دالة feed-import في ملف واحد (لصقها في محرر Supabase): core.mjs + المناطق + io.ts
// التشغيل: node scripts/build-feed-function.mjs
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(ROOT, 'supabase/functions/feed-import');
const core = fs.readFileSync(path.join(dir, 'core.mjs'), 'utf8').replace(/^export /gm, '');
const io = fs.readFileSync(path.join(dir, 'io.ts'), 'utf8');
const ctx = { window: {}, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/aq-areas.js'), 'utf8'), ctx);
const areas = ctx.window.AQAreas.AREAS.map((a) => ({ ar: a.ar, en: a.en, dld: a.dld || [], words: a.words || [] }));
const out = `// ⚠️ ملف مُولَّد من core.mjs و io.ts — عدّل المصدر ثم شغّل node scripts/build-feed-function.mjs
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser } from 'npm:fast-xml-parser@4';

${core}
const AREAS = ${JSON.stringify(areas)};

${io}`;
fs.writeFileSync(path.join(dir, 'index.ts'), out);
console.log('index.ts', out.length, 'bytes');
