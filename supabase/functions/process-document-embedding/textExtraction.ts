
export async function extractTextFromPDF(pdfData: Blob): Promise<string> {
  try {
    // For now, we'll use a simple text extraction
    // In a production environment, you might want to use a more robust PDF parser
    const text = await pdfData.text();
    return text.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}
