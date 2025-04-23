
// Use ESM import format for pdf-parse
export async function extractTextFromPDF(pdfData: Blob): Promise<string> {
  try {
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Import pdf-parse dynamically with the proper ESM syntax for Deno
    const PDFParser = await import('npm:pdf-parse');
    
    const data = await PDFParser.default(uint8Array);
    
    // Remove extra whitespace and normalize text
    const normalizedText = data.text
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/[\r\n]+/g, '\n')  // Normalize line breaks
      .trim();

    if (!normalizedText) {
      throw new Error('No text content extracted from PDF');
    }

    console.log(`Successfully extracted ${normalizedText.length} characters from PDF`);
    return normalizedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}
