import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
    if (transporter) return transporter;

    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
        pool: true
    });
    return transporter;
};

export const isPasswordResetEmailConfigured = () =>
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);

export const sendPasswordResetEmail = async (email, resetUrl) => {
    await getTransporter().sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Reset your ShopVerse password",
        text: `We received a request to reset your password. Open this link within 15 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>We received a request to reset your ShopVerse password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>`
    });
};
