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
    // Try ### Chapter N, then # Chapter N, then filename prefix
    let numberMatch = content.match(/^### Chapter (\d+)/m) || content.match(/^# Chapter (\d+)/m);
    let number = numberMatch ? parseInt(numberMatch[1]) : parseInt(file.split('.')[0]);
    
    const titleMatch = content.match(/^# (.+)/m);
    const summaryMatch = content.match(/^## (.+)/m);
    
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    
    // Remove original headers from body
    let body = content
        .replace(/^### Chapter \d+$/m, '')
        .replace(/^# Chapter \d+$/m, '')
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
    console.log(`Migrated ${file} to ${targetFile} (Chapter ${number})`);
});
