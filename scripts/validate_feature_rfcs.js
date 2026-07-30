import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const rfcDir = path.join(projectRoot, 'docs/architecture-decision-records/features');

console.log('=== Running Ground-Truth Feature RFC Validation Suite ===');

if (!fs.existsSync(rfcDir)) {
  console.error('Error: RFC directory not found!');
  process.exit(1);
}

const files = fs.readdirSync(rfcDir).filter(f => f.endsWith('.md') && f !== 'README.md');
console.log(`Found ${files.length} Feature RFC files.`);

let errors = 0;

if (files.length !== 71) {
  console.error(`Validation Error: Expected 71 RFC files, but found ${files.length}.`);
  errors++;
}

for (const file of files) {
  const filePath = path.join(rfcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check 1: No file:/// absolute links
  if (content.includes('file:///Users/')) {
    console.error(`[${file}] Contains absolute file:/// link!`);
    errors++;
  }

  // Check 2: All 7 sections present
  const requiredSections = [
    '## 1. 演進軌跡與背景動機',
    '## 2. 邊界與成功標準',
    '## 3. 架構與系統流向',
    '## 4. 微觀工程與程式碼替代方案對比',
    '## 5. 爆炸半徑與失敗矩陣',
    '## 6. 運維與回滾步驟',
    '## 7. 面試問答口述講稿',
  ];

  for (const sec of requiredSections) {
    if (!content.includes(sec)) {
      console.error(`[${file}] Missing required section: ${sec}`);
      errors++;
    }
  }

  // Check 3: Implementation Status present
  if (!content.includes('實作狀態 (Implementation Status)')) {
    console.error(`[${file}] Missing Implementation Status header!`);
    errors++;
  }
}

if (errors === 0) {
  console.log('SUCCESS: All 71 Feature RFC files passed validation cleanly (0 errors)!');
} else {
  console.error(`FAILED: Found ${errors} validation errors across Feature RFC files.`);
  process.exit(1);
}
