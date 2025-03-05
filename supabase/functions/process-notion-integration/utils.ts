
// Split text into chunks
export function chunk(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const words = text.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= chunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
