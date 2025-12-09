import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'backend', 'config', 'api-keys.json');
const EMAIL_CONFIG_FILE_PATH = path.join(process.cwd(), 'backend', 'config', 'email-config.json');

class ConfigController {
  getConfigFilePath() {
    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return CONFIG_FILE_PATH;
  }

  getEmailConfigFilePath() {
    // Ensure config directory exists
    const configDir = path.dirname(EMAIL_CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return EMAIL_CONFIG_FILE_PATH;
  }

  getApiKeys(req, res) {
    try {
      const configPath = this.getConfigFilePath();
      
      if (!fs.existsSync(configPath)) {
        return res.json({
          success: true,
          config: null,
        });
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);

      // Return keys as masked (only show if they exist, not the actual values)
      const maskedKeys = {};
      if (config.keys) {
        Object.keys(config.keys).forEach((providerId) => {
          maskedKeys[providerId] = config.keys[providerId] ? '***' : '';
        });
      }

      res.json({
        success: true,
        config: {
          keys: maskedKeys, // Return masked keys for security
          order: config.order || [],
          enabled: config.enabled || config.order || [], // Enabled providers
        },
      });
    } catch (err) {
      console.error('Error reading API keys config:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to read configuration',
      });
    }
  }

  saveApiKeys(req, res) {
    try {
      const { keys, order, enabled } = req.body;

      if (!order || !Array.isArray(order)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration format',
        });
      }

      const configPath = this.getConfigFilePath();
      let existingConfig = { keys: {}, order: [], enabled: [] };

      // Load existing config to preserve keys that aren't being updated
      if (fs.existsSync(configPath)) {
        try {
          const existingData = fs.readFileSync(configPath, 'utf8');
          existingConfig = JSON.parse(existingData);
        } catch (err) {
          console.log('Could not read existing config, starting fresh');
        }
      }

      // Merge new keys with existing keys (only update keys that are provided)
      const mergedKeys = { ...existingConfig.keys };
      if (keys) {
        Object.keys(keys).forEach((providerId) => {
          const newKey = keys[providerId]?.trim();
          // Only update if a new key is provided (not masked value)
          if (newKey && newKey !== '***' && newKey.length > 0) {
            mergedKeys[providerId] = newKey;
          }
        });
      }

      // Determine enabled providers (use provided enabled array, or default to all with keys)
      const enabledProviders = enabled && Array.isArray(enabled) 
        ? enabled 
        : order.filter((providerId) => mergedKeys[providerId] && mergedKeys[providerId].trim().length > 0);

      // Validate: at least one provider must be enabled
      if (enabledProviders.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one AI provider must be enabled',
        });
      }

      // Save configuration
      const configToSave = {
        keys: mergedKeys,
        order: order,
        enabled: enabledProviders,
      };

      fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf8');

      // Return masked keys
      const maskedKeys = {};
      Object.keys(configToSave.keys).forEach((providerId) => {
        maskedKeys[providerId] = configToSave.keys[providerId] ? '***' : '';
      });

      res.json({
        success: true,
        message: 'Configuration saved successfully',
        config: {
          keys: maskedKeys,
          order: configToSave.order,
          enabled: configToSave.enabled,
        },
      });
    } catch (err) {
      console.error('Error saving API keys config:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to save configuration',
      });
    }
  }

  getEmailConfig(req, res) {
    try {
      const configPath = this.getEmailConfigFilePath();
      
      if (!fs.existsSync(configPath)) {
        return res.json({
          success: true,
          config: {
            enabled: false,
            email: '',
          },
        });
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);

      res.json({
        success: true,
        config: {
          enabled: config.enabled || false,
          email: config.email || '',
        },
      });
    } catch (err) {
      console.error('Error reading email config:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to read email configuration',
      });
    }
  }

  saveEmailConfig(req, res) {
    try {
      const { enabled, email } = req.body;

      if (enabled === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Enabled status is required',
        });
      }

      // If enabled, email must be provided and valid
      if (enabled) {
        if (!email || !email.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Email address is required when email is enabled',
          });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid email address format',
          });
        }
      }

      const configPath = this.getEmailConfigFilePath();
      const configToSave = {
        enabled: enabled,
        email: enabled ? email.trim() : '',
      };

      fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf8');

      res.json({
        success: true,
        message: 'Email configuration saved successfully',
        config: configToSave,
      });
    } catch (err) {
      console.error('Error saving email config:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to save email configuration',
      });
    }
  }
}

export default new ConfigController();

