const fs = require('fs');

function extractFormattedText(file) {
  if (!fs.existsSync(file)) return '';
  const xml = fs.readFileSync(file, 'utf8');
  const paragraphs = xml.match(/<w:p[\s>].*?<\/w:p>/g) || [];
  
  let result = '';
  for (const p of paragraphs) {
    let pText = '';
    const runs = p.match(/<w:r[\s>].*?<\/w:r>/g) || [];
    for (const r of runs) {
      const colorMatch = r.match(/<w:color w:val=\"([^\"]+)\"/);
      const color = colorMatch ? '#' + colorMatch[1] : 'default';
      const bMatch = r.match(/<w:b[\s\/>]/);
      const isBold = !!bMatch;
      const sizeMatch = r.match(/<w:sz w:val=\"(\d+)\"/);
      const size = sizeMatch ? parseInt(sizeMatch[1])/2 : 11; // half-points to points
      
      const tMatches = r.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
      for (const t of tMatches) {
        const text = t.replace(/<[^>]+>/g, '');
        pText += text;
      }
      if (tMatches.length > 0) {
        result += `[Color: ${color}, Bold: ${isBold}, Size: ${size}] ${tMatches.map(t=>t.replace(/<[^>]+>/g, '')).join('')}\n`;
      }
    }
    result += '\n--- Paragraph End ---\n';
  }
  return result;
}

console.log('--- header1.xml Text ---');
console.log(extractFormattedText('temp_docx/word/header1.xml'));
