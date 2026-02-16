import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",   // ✅ must be this
  port: 587,
  secure: false,            // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // app password
  },
});
