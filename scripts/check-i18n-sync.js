const fs = require('fs');
const path = require('path');

const koKRPath = path.join(__dirname, '../packages/ui/src/i18n/locales/ko-KR.json');
const enUSPath = path.join(__dirname, '../packages/ui/src/i18n/locales/en-US.json');

function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading or parsing ${filePath}:`, error.message);
        process.exit(1);
    }
}

function getKeys(obj, prefix = '') {
    let keys = new Set();
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            getKeys(obj[key], fullKey).forEach(k => keys.add(k));
        } else {
            keys.add(fullKey);
        }
    }
    return keys;
}

const koKRData = readJsonFile(koKRPath);
const enUSData = readJsonFile(enUSPath);

const koKRKeys = getKeys(koKRData);
const enUSKeys = getKeys(enUSData);

let missingInEnUS = [...koKRKeys].filter(key => !enUSKeys.has(key));
let missingInKoKR = [...enUSKeys].filter(key => !koKRKeys.has(key));

if (missingInKoKR.length > 0 || missingInEnUS.length > 0) {
    console.error('❌ i18n key synchronization check failed!');
    if (missingInKoKR.length > 0) {
        console.error('Keys missing in ko-KR.json:');
        missingInKoKR.forEach(key => console.error(`  - ${key}`));
    }
    if (missingInEnUS.length > 0) {
        console.error('Keys missing in en-US.json:');
        missingInEnUS.forEach(key => console.error(`  - ${key}`));
    }
    process.exit(1);
} else {
    console.log('✅ i18n key synchronization check passed. All keys are in sync.');
    process.exit(0);
}