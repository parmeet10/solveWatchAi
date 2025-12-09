import Tesseract from 'tesseract.js';

class OCRService {
  async extractText(imagePath) {
    try {
      const textData = await Tesseract.recognize(imagePath, 'eng');
      return textData.data.text;
    } catch (err) {
      console.error('Error extracting text from image:', err);
      throw err;
    }
  }
}

export default new OCRService();

