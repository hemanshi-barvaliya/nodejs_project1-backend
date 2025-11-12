import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text, html = null) => {
  console.log("📧 Starting email send...");
  console.log("➡️ EMAIL_USER:", process.env.EMAIL_USER);
  console.log("➡️ EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

  try {
    // Use Gmail's built-in service config for simpler setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log("🔄 Verifying Gmail SMTP connection...");
    await transporter.verify();
    console.log("✅ Gmail SMTP verified successfully");

    const mailOptions = {
      from: `"No Reply" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    };

    let attempts = 0;
    let info;

    // Auto retry up to 3 times if Gmail temporarily blocks
    while (attempts < 3) {
      try {
        attempts++;
        console.log(`📤 Attempt ${attempts}: Sending email to ${to}`);
        info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully:", info.messageId);
        console.log("📨 Gmail response:", info.response);
        return info;
      } catch (err) {
        console.error(`⚠️ Attempt ${attempts} failed: ${err.message}`);
        if (attempts >= 3) throw err;
        console.log("⏳ Retrying in 3 seconds...");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  } catch (error) {
    console.error("❌ Detailed Email Error:");
    console.error("Message:", error.message);
    console.error("Code:", error.code || "N/A");
    if (error.command) console.error("Command:", error.command);
    if (error.response) console.error("📩 SMTP Response:", error.response);
    console.error("Stack:", error.stack);
    throw new Error("Failed to send email. Check Gmail credentials or App Password.");
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

