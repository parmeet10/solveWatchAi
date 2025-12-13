/**
 * Service for refining and correcting speech-to-text output
 * Specifically designed for Sherpa-ONNX output from mobile devices
 */
import aiService from './ai.service.js';
import logger from '../utils/logger.js';

const log = logger('TextRefinementService');

class TextRefinementService {
  /**
   * Refine a text chunk from Sherpa-ONNX speech recognition
   * Corrects spelling, grammar, punctuation, and technical terms
   * @param {string} rawText - Raw text from Sherpa-ONNX
   * @returns {Promise<string>} Refined text
   */
  async refineTextChunk(rawText) {
    if (!rawText || rawText.trim().length === 0) {
      return '';
    }

    try {
      const prompt = `Correct and refine this speech-to-text output from Sherpa-ONNX model on a mobile device.

Fix the following types of errors:
- Spelling mistakes
- Grammar errors
- Punctuation issues
- Technical term errors (e.g., "react" → "React", "API" → "API", "javascript" → "JavaScript")
- Code syntax mentions (e.g., "equals" → "==", "arrow function" → "=>", "function" → "function")
- Programming concepts (e.g., "async await", "promise", "variable")

Preserve the original meaning and intent. Keep the text natural and conversational.
Do NOT add explanations or comments. Return ONLY the corrected text.

Text to correct: "${rawText}"`;

      const messages = [
        {
          role: 'system',
          content:
            'You are a text correction system specialized in fixing speech-to-text errors, especially for technical and programming content. Return only the corrected text without any explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      log.debug('Refining text chunk', { originalLength: rawText.length });

      const response = await aiService.callAIWithFallback(messages, {
        temperature: 0.3, // Lower temperature for more consistent corrections
        max_tokens: 512,
      });

      const refinedText =
        typeof response === 'string'
          ? response
          : response.message?.content || response;

      log.debug('Text refined', {
        originalLength: rawText.length,
        refinedLength: refinedText.length,
      });

      return refinedText.trim();
    } catch (error) {
      log.error('Error refining text chunk', error);
      // Return original text if refinement fails
      return rawText;
    }
  }

  /**
   * Refine multiple text chunks (batch processing)
   * @param {Array<string>} textChunks - Array of raw text chunks
   * @returns {Promise<Array<string>>} Array of refined text chunks
   */
  async refineTextChunks(textChunks) {
    if (!Array.isArray(textChunks) || textChunks.length === 0) {
      return [];
    }

    // Refine chunks in parallel for speed
    const refinementPromises = textChunks.map((chunk) =>
      this.refineTextChunk(chunk),
    );

    try {
      const refinedChunks = await Promise.all(refinementPromises);
      return refinedChunks.filter((text) => text.length > 0);
    } catch (error) {
      log.error('Error refining text chunks', error);
      return textChunks; // Return original chunks if refinement fails
    }
  }
}

export default new TextRefinementService();

