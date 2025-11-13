const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#667eea';
  ctx.fillRect(0, 0, size, size);

  // 텍스트
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎬', size / 2, size / 2);

  // 저장
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
}

['16', '48', '128'].forEach(size => generateIcon(parseInt(size)));

console.log('아이콘 생성 완료!');