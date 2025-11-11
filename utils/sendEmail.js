import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text, html = null) => {
  console.log("📧 Starting email send...");
  console.log("➡️ Host:", process.env.EMAIL_HOST);
  console.log("➡️ Port:", process.env.EMAIL_PORT);
  console.log("➡️ User:", process.env.EMAIL_USER);
  console.log("➡️ Pass exists:", !!process.env.EMAIL_PASS);

  try {
    // Determine if connection should be secure (port 465 = true)
    const secure = Number(process.env.EMAIL_PORT) === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false, // helps with self-signed certs or SSL issues
      },
    });

    console.log("🔄 Verifying SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP connection successful");

    const mailOptions = {
      from: `"No Reply" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html, // optional HTML version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Detailed Email Error:");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Stack:", error.stack);
    if (error.response) console.error("📩 SMTP Response:", error.response);
    throw new Error("Failed to send email. Check SMTP config and credentials.");
  }
};


// import dotenv from "dotenv";
// dotenv.config();
// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export const sendEmail = async (to, subject, text, html) => {
//   try {
//     console.log("📧 Sending email via Resend API...");

//     const response = await resend.emails.send({
//       from: "Your App <onboarding@resend.dev>",
//       to,
//       subject,
//       text,
//       html,
//     });

//     console.log("✅ Email sent successfully, ID:", response.id);
//     return response;
//   } catch (error) {
//     console.error("❌ Resend Email Error:", error);
//     throw new Error("Failed to send email");
//   }
// };

