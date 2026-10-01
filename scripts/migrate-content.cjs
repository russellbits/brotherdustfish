const fs = require('fs');
const path = require('path');

const sourceDir = './contents';
const targetDir = './src/content/chapters';

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));

files.forEach(file => {
    const content = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    
    // Extraction
    const chapterMatch = content.match(/^### Chapter (\d+)/m);
    const titleMatch = content.match(/^# (.+)/m);
    const summaryMatch = content.match(/^## (.+)/m);
    
    const number = chapterMatch ? parseInt(chapterMatch[1]) : 0;
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    
    // Remove original headers from body
    let body = content
        .replace(/^### Chapter \d+$/m, '')
        .replace(/^# .+/m, '')
        .replace(/^## .+/m, '')
        .trim();
    
    const frontmatter = `---
title: "${title}"
number: ${number}
summary: "${summary}"
---

${body}`;
    
    const targetFile = file.replace('.md', '.mdx');
    fs.writeFileSync(path.join(targetDir, targetFile), frontmatter);
    console.log(`Migrated ${file} to ${targetFile}`);
});
