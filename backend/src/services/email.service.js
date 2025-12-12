import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const log = logger('EmailService');

class EmailService {
  async sendMail(from, to, subject, text) {
    const mailOptions = {
      from,
      to,
      subject,
      text,
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'sparmeet162000@gmail.com',
        pass: process.env.EMAIL_PASS,
      },
    });

    try {
      const info = await transporter.sendMail(mailOptions);
      log.info('Email sent successfully', { to, subject });
      return info;
    } catch (err) {
      log.error('Error sending email', err);
      throw err;
    }
  }
}

export default new EmailService();
