import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const CONFIG_FILE_PATH = path.join(
  process.cwd(),
  'backend',
  'config',
  'api-keys.json',
);

class AIService {
  constructor() {
    this.config = null;
    this.loadConfig();
    // Track failed providers with timestamps
    // Format: { providerId: timestamp }
    this.failedProviders = new Map();
    // Retry failed providers after 5 minutes (300000 ms)
    this.FAILURE_TIMEOUT = 5 * 60 * 1000;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        // Fallback to environment variables for backward compatibility
        this.config = {
          keys: {},
          order: [],
        };

        // Check for env vars and add them
        if (process.env.OPENAI_API_KEY) {
          this.config.keys.openai = process.env.OPENAI_API_KEY;
          this.config.order.push('openai');
        }
        if (process.env.GROQ_API_KEY) {
          this.config.keys.grok = process.env.GROQ_API_KEY;
          this.config.order.push('grok');
        }
        if (process.env.GEMINI_API_KEY) {
          this.config.keys.gemini = process.env.GEMINI_API_KEY;
          this.config.order.push('gemini');
        }
      }
    } catch (err) {
      console.error('Error loading AI config:', err);
      this.config = { keys: {}, order: [] };
    }
  }

  reloadConfig() {
    this.loadConfig();
  }

  getAvailableProviders() {
    this.reloadConfig();
    if (!this.config) {
      return [];
    }

    // Use enabled providers if specified, otherwise fall back to order with keys
    const enabledProviders = this.config.enabled || [];
    const providersToUse =
      enabledProviders.length > 0
        ? enabledProviders
        : (this.config.order || []).filter((providerId) => {
            const key = this.config.keys[providerId];
            return key && key.trim().length > 0;
          });

    // Filter to only include providers that have keys
    const availableProviders = providersToUse.filter((providerId) => {
      const key = this.config.keys[providerId];
      return key && key.trim().length > 0;
    });

    // Filter out recently failed providers (unless timeout has passed)
    const now = Date.now();
    return availableProviders.filter((providerId) => {
      const failedAt = this.failedProviders.get(providerId);
      if (!failedAt) {
        return true; // Provider hasn't failed, include it
      }

      // Check if failure timeout has passed
      const timeSinceFailure = now - failedAt;
      if (timeSinceFailure >= this.FAILURE_TIMEOUT) {
        // Timeout passed, remove from failed list and retry
        this.failedProviders.delete(providerId);
        console.log(
          `🔄 Retrying ${providerId} after timeout (${Math.round(
            timeSinceFailure / 1000,
          )}s since failure)`,
        );
        return true;
      }

      // Provider failed recently, skip it
      return false;
    });
  }

  markProviderAsFailed(providerId) {
    this.failedProviders.set(providerId, Date.now());
    console.log(
      `⚠️  Marked ${providerId} as failed. Will skip for ${
        this.FAILURE_TIMEOUT / 1000
      }s`,
    );
  }

  markProviderAsSuccess(providerId) {
    // Clear failed status if provider succeeds
    if (this.failedProviders.has(providerId)) {
      this.failedProviders.delete(providerId);
      console.log(`✅ ${providerId} recovered - removed from failed list`);
    }
  }

  async callOpenAI(messages, options = {}) {
    const apiKey = this.config?.keys?.openai;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const completion = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2048,
    });

    return completion.choices[0]?.message?.content || 'No response generated';
  }

  async callGrok(messages, options = {}) {
    const apiKey = this.config?.keys?.grok;
    if (!apiKey) {
      throw new Error('Grok API key not configured');
    }

    const groq = new Groq({
      apiKey: apiKey,
    });

    const completion = await groq.chat.completions.create({
      model: options.model || 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2048,
    });

    return completion.choices[0]?.message?.content || 'No response generated';
  }

  async callGemini(messages, options = {}) {
    const apiKey = this.config?.keys?.gemini;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-pro',
    });

    // Convert messages format for Gemini
    // Gemini expects a single prompt string or structured content
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';
    const systemMessage =
      messages.find((m) => m.role === 'system')?.content || '';

    const prompt = systemMessage
      ? `${systemMessage}\n\n${userMessage}`
      : userMessage;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || 'No response generated';
  }

  async callAIWithFallback(messages, options = {}) {
    // Get providers, excluding recently failed ones
    const providers = this.getAvailableProviders();

    if (providers.length === 0) {
      // Check if all providers are failed (but timeout hasn't passed)
      this.reloadConfig();
      const enabledProviders = this.config?.enabled || this.config?.order || [];
      const allProviders = enabledProviders.filter((providerId) => {
        const key = this.config?.keys?.[providerId];
        return key && key.trim().length > 0;
      });

      if (allProviders.length > 0) {
        const failedCount = Array.from(this.failedProviders.keys()).length;
        if (failedCount > 0) {
          const now = Date.now();
          const failedList = Array.from(this.failedProviders.entries())
            .map(([id, timestamp]) => {
              const timeLeft = Math.ceil(
                (this.FAILURE_TIMEOUT - (now - timestamp)) / 1000,
              );
              return `${id} (retry in ${timeLeft}s)`;
            })
            .join(', ');

          throw new Error(
            `All AI providers are temporarily unavailable. Failed providers: ${failedList}. Will retry after timeout.`,
          );
        }
      }

      throw new Error(
        'No AI providers configured. Please configure at least one API key.',
      );
    }

    let lastError = null;

    for (const providerId of providers) {
      try {
        console.log(`🤖 Trying ${providerId}...`);
        let response;

        switch (providerId) {
          case 'openai':
            response = await this.callOpenAI(messages, options);
            break;
          case 'grok':
            response = await this.callGrok(messages, options);
            break;
          case 'gemini':
            response = await this.callGemini(messages, options);
            break;
          default:
            throw new Error(`Unknown provider: ${providerId}`);
        }

        // Mark provider as successful (clear any failed status)
        this.markProviderAsSuccess(providerId);
        console.log(`✅ Success with ${providerId}`);
        return {
          message: {
            content: response,
          },
          provider: providerId,
        };
      } catch (err) {
        console.error(`❌ ${providerId} failed:`, err.message);
        // Mark provider as failed
        this.markProviderAsFailed(providerId);
        lastError = err;
        // Continue to next provider
      }
    }

    // All available providers failed (they're now marked as failed)
    throw new Error(
      `All AI providers failed. Last error: ${
        lastError?.message || 'Unknown error'
      }`,
    );
  }

  readPromptFromFile() {
    try {
      const promptPath = path.join(
        process.cwd(),
        'backend',
        'prompts',
        'system-prompt.txt',
      );
      return fs.readFileSync(promptPath, 'utf8').trim();
    } catch (err) {
      console.log('Warning: Could not read prompt file, using default prompt');
      return 'Analyze this screenshot text and provide insights';
    }
  }

  readContextPromptFromFile(context) {
    try {
      const promptPath = path.join(
        process.cwd(),
        'backend',
        'prompts',
        'context-prompt.txt',
      );
      let contextPrompt = fs.readFileSync(promptPath, 'utf8').trim();
      contextPrompt = contextPrompt.replace(
        '{CONTEXT}',
        context || 'No previous context available',
      );
      return contextPrompt;
    } catch (err) {
      console.log(
        'Warning: Could not read context prompt file, using default prompt',
      );
      return `Previous context:\n${context}\n\nAnalyze this screenshot text and provide insights`;
    }
  }

  readClipboardPromptFromFile() {
    try {
      const promptPath = path.join(
        process.cwd(),
        'backend',
        'prompts',
        'clipboard-prompt.txt',
      );
      return fs.readFileSync(promptPath, 'utf8').trim();
    } catch (err) {
      console.log(
        'Warning: Could not read clipboard prompt file, using default prompt',
      );
      return 'Analyze this clipboard content and solve any questions or provide code output';
    }
  }

  async askGpt(text) {
    this.reloadConfig();
    const systemPrompt = this.readPromptFromFile();

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Screenshot text:\n${text}`,
      },
    ];

    return await this.callAIWithFallback(messages, {
      temperature: 0.7,
      max_tokens: 2048,
    });
  }

  async askGptWithContext(text, previousResponse) {
    this.reloadConfig();
    const systemPrompt = this.readContextPromptFromFile(previousResponse);

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Screenshot text:\n${text}`,
      },
    ];

    return await this.callAIWithFallback(messages, {
      temperature: 0.7,
      max_tokens: 2048,
    });
  }

  async askGptClipboard(clipboardContent) {
    this.reloadConfig();
    const systemPrompt = this.readClipboardPromptFromFile();

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Clipboard content:\n${clipboardContent}`,
      },
    ];

    return await this.callAIWithFallback(messages, {
      temperature: 0.7,
      max_tokens: 2048,
    });
  }
}

export default new AIService();
