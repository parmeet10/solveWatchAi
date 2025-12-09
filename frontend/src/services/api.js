const API_BASE_URL = '/api';

class ApiService {
  async uploadImage(formData) {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload image');
    }

    return response.json();
  }

  async getProcessedData() {
    const response = await fetch(`${API_BASE_URL}/data`);

    if (!response.ok) {
      throw new Error('Failed to fetch processed data');
    }

    return response.json();
  }

  async getContextState() {
    const response = await fetch(`${API_BASE_URL}/context-state`);

    if (!response.ok) {
      throw new Error('Failed to fetch context state');
    }

    return response.json();
  }

  async updateContextState(enabled) {
    const response = await fetch(`${API_BASE_URL}/context-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update context state');
    }

    return response.json();
  }

  async processClipboard(content) {
    const response = await fetch(`${API_BASE_URL}/clipboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process clipboard content');
    }

    return response.json();
  }

  async getApiKeysConfig() {
    const response = await fetch(`${API_BASE_URL}/config/keys`);

    if (!response.ok) {
      throw new Error('Failed to fetch API keys configuration');
    }

    return response.json();
  }

  async saveApiKeysConfig(config) {
    const response = await fetch(`${API_BASE_URL}/config/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save API keys configuration');
    }

    return response.json();
  }

  async getEmailConfig() {
    const response = await fetch(`${API_BASE_URL}/config/email`);

    if (!response.ok) {
      throw new Error('Failed to fetch email configuration');
    }

    return response.json();
  }

  async saveEmailConfig(config) {
    const response = await fetch(`${API_BASE_URL}/config/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save email configuration');
    }

    return response.json();
  }
}

export default new ApiService();
