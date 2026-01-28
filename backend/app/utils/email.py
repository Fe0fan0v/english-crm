"""Email utilities for sending notifications."""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
) -> bool:
    """
    Send an email using SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        text_content: Plain text content (optional, falls back to html_content)

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not settings.email_enabled:
        logger.info(f"Email sending is disabled. Would send to {to_email}: {subject}")
        return False

    if not settings.smtp_username or not settings.smtp_password:
        logger.warning("SMTP credentials not configured. Cannot send email.")
        return False

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        message["To"] = to_email

        # Attach text and HTML parts
        if text_content:
            text_part = MIMEText(text_content, "plain", "utf-8")
            message.attach(text_part)

        html_part = MIMEText(html_content, "html", "utf-8")
        message.attach(html_part)

        # Send email
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            start_tls=True,
        )

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


async def send_message_notification(
    recipient_email: str,
    recipient_name: str,
    sender_name: str,
    message_preview: str,
) -> bool:
    """
    Send notification about new direct message.

    Args:
        recipient_email: Recipient's email address
        recipient_name: Recipient's name
        sender_name: Sender's name
        message_preview: Preview of the message (first 100 characters)

    Returns:
        True if email was sent successfully, False otherwise
    """
    subject = f"Новое сообщение от {sender_name} - Just Speak It"

    # HTML content
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }}
            .content {{
                background: #f9fafb;
                padding: 30px 20px;
                border: 1px solid #e5e7eb;
                border-top: none;
            }}
            .message-box {{
                background: white;
                padding: 20px;
                border-left: 4px solid #06b6d4;
                margin: 20px 0;
                border-radius: 4px;
            }}
            .button {{
                display: inline-block;
                background: #06b6d4;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
            }}
            .footer {{
                background: #f3f4f6;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #6b7280;
                border-radius: 0 0 8px 8px;
                border: 1px solid #e5e7eb;
                border-top: none;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📨 Новое сообщение</h1>
        </div>
        <div class="content">
            <p>Здравствуйте, {recipient_name}!</p>
            <p>Вы получили новое сообщение от <strong>{sender_name}</strong>:</p>
            <div class="message-box">
                <p>{message_preview}</p>
            </div>
            <p>
                <a href="https://justspeak.heliad.ru/student" class="button">
                    Прочитать сообщение
                </a>
            </p>
        </div>
        <div class="footer">
            <p>Just Speak It - Языковая школа английского языка</p>
            <p>Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.</p>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_content = f"""
    Здравствуйте, {recipient_name}!

    Вы получили новое сообщение от {sender_name}:

    {message_preview}

    Перейдите в свой личный кабинет, чтобы прочитать сообщение:
    https://justspeak.heliad.ru/student

    ---
    Just Speak It - Языковая школа английского языка
    Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.
    """

    return await send_email(
        to_email=recipient_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
    )
