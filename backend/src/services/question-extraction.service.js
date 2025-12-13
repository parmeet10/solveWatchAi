/**
 * Service for extracting technical questions from refined text
 */
import aiService from './ai.service.js';
import logger from '../utils/logger.js';

const log = logger('QuestionExtractionService');

class QuestionExtractionService {
  /**
   * Extract technical questions from refined text
   * @param {string} refinedText - Already refined/corrected text
   * @param {string} sessionId - Session ID for logging
   * @returns {Promise<Array>} Array of extracted questions with metadata
   */
  async extractQuestions(refinedText, sessionId) {
    if (!refinedText || refinedText.trim().length === 0) {
      return [];
    }

    try {
      const prompt = `Extract technical questions from this corrected speech-to-text output.

A technical question typically:
- Asks about programming, coding, algorithms, software concepts
- Contains technical terms (React, JavaScript, API, Python, Node.js, etc.)
- Uses question words: "how", "what", "why", "when", "where", "can", "should", "is", "does"
- Has a question mark (?) or is clearly interrogative
- Is about code, debugging, implementation, concepts, or technical solutions

Rules:
1. Extract only clear technical questions
2. Extract complete questions (not fragments)
3. If a question spans multiple sentences, include all relevant parts
4. Each question should be self-contained and answerable
5. Return ONLY valid JSON array

Text: "${refinedText}"

Return JSON array format:
[
  {
    "question": "fully extracted and corrected question text",
    "type": "technical",
    "confidence": 0.9
  }
]

If no questions found, return empty array: []`;

      const messages = [
        {
          role: 'system',
          content:
            'You are a question extraction system. Extract technical questions from text. Return only valid JSON array. Never include explanations, only JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      log.debug('Extracting questions', {
        sessionId,
        textLength: refinedText.length,
      });

      const response = await aiService.callAIWithFallback(messages, {
        temperature: 0.5, // Balanced for extraction
        max_tokens: 512,
      });

      const responseText =
        typeof response === 'string'
          ? response
          : response.message?.content || response;

      // Parse JSON response
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '').trim();
        }

        const questions = JSON.parse(cleanedResponse);

        if (!Array.isArray(questions)) {
          log.warn('Response is not an array, using fallback extraction');
          return this.fallbackExtraction(refinedText);
        }

        // Filter and validate questions
        const validQuestions = questions
          .filter((q) => q && q.question && q.question.trim().length > 0)
          .map((q) => ({
            question: q.question.trim(),
            type: q.type || 'technical',
            confidence: q.confidence || 0.8,
          }));

        log.info('Questions extracted', {
          sessionId,
          count: validQuestions.length,
        });

        return validQuestions;
      } catch (parseError) {
        log.warn('Failed to parse JSON response, using fallback extraction', {
          error: parseError.message,
          response: responseText.substring(0, 200),
        });
        return this.fallbackExtraction(refinedText);
      }
    } catch (error) {
      log.error('Error extracting questions', error);
      // Fallback to regex extraction
      return this.fallbackExtraction(refinedText);
    }
  }

  /**
   * Fallback extraction using regex patterns
   * Used when AI parsing fails
   * @param {string} text - Text to extract questions from
   * @returns {Array} Array of extracted questions
   */
  fallbackExtraction(text) {
    // Simple regex for question detection
    const questionRegex = /[^.!?]*\?[^.!?]*/g;
    const matches = text.match(questionRegex) || [];

    const questions = matches
      .map((q) => q.trim())
      .filter((q) => q.length > 10) // Filter very short matches
      .map((q) => ({
        question: q,
        type: 'technical',
        confidence: 0.7,
      }));

    log.debug('Fallback extraction', { count: questions.length });

    return questions;
  }
}

export default new QuestionExtractionService();

