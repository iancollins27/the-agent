
// Split text into chunks of roughly equal size
export function chunk(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  
  // If the text is shorter than the chunk size, return it as a single chunk
  if (text.length <= chunkSize) {
    return [text];
  }
  
  // Try to split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  // Process each paragraph
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size and we already have content
    if (currentChunk.length > 0 && (currentChunk.length + paragraph.length + 2) > chunkSize) {
      // Save current chunk
      chunks.push(currentChunk);
      currentChunk = '';
    }
    
    // If the paragraph itself is longer than chunk size, split it by sentences
    if (paragraph.length > chunkSize) {
      // Split the paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      
      for (const sentence of sentences) {
        if (currentChunk.length > 0 && (currentChunk.length + sentence.length + 1) > chunkSize) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // If sentence is still too long, split by words
        if (sentence.length > chunkSize) {
          const words = sentence.split(' ');
          for (const word of words) {
            if (currentChunk.length > 0 && (currentChunk.length + word.length + 1) > chunkSize) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            
            currentChunk += (currentChunk ? ' ' : '') + word;
          }
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
    } else {
      // Add the paragraph to the current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
    
    // If current chunk is getting too large, save it
    if (currentChunk.length >= chunkSize * 0.8) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  }
  
  // Add any remaining content as the final chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Helper function to estimate token count for chunking
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
