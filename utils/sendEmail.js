import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
    console.log("📧 Starting email send...");
    console.log(" Host:", process.env.EMAIL_HOST);
    console.log(" Port:", process.env.EMAIL_PORT);
    console.log(" User:", process.env.EMAIL_USER);
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465, // automatically match port
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // test SMTP connection
    await transporter.verify();
    console.log("✅ SMTP connection successful");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });

    console.log("✅ Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("❌ Detailed Email Error:");
    console.error(error);
    if (error.response) 
      console.error("📩 SMTP Response:", error.response);
    throw new Error("Failed to send email");
  }
};
