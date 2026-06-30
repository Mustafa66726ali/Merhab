"""إرسال البريد عبر تكامل SMTP (Gmail وغيره) المُكوَّن من مدير النظام."""

from __future__ import annotations

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from apps.integrations.models import IntegrationCredential


def get_active_email_smtp() -> IntegrationCredential | None:
    """اعتماد SMTP نشط وأساسي لإرسال رسائل الاستعادة والإشعارات."""
    cred = (
        IntegrationCredential.objects.filter(
            provider=IntegrationCredential.Provider.EMAIL_SMTP,
            is_active=True,
            is_primary=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if cred and cred.smtp_host and cred.smtp_port and cred.api_key and cred.from_email:
        return cred
    # احتياطي: أي SMTP نشط
    cred = (
        IntegrationCredential.objects.filter(
            provider=IntegrationCredential.Provider.EMAIL_SMTP,
            is_active=True,
        )
        .order_by("-is_primary", "-updated_at")
        .first()
    )
    if cred and cred.smtp_host and cred.smtp_port and cred.api_key and cred.from_email:
        return cred
    return None


def is_password_recovery_configured() -> bool:
    return get_active_email_smtp() is not None


def send_smtp_email(
    cred: IntegrationCredential,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> tuple[bool, str]:
    """يُرسل بريداً عبر SMTP. ``api_key`` = كلمة مرور التطبيق (Gmail App Password)."""
    to_email = (to_email or "").strip().lower()
    if not to_email:
        return False, "عنوان المستلم غير صالح"

    from_email = cred.from_email.strip()
    from_name = (cred.from_name or "مرحّاب").strip()
    password = cred.api_key.strip()
    host = cred.smtp_host.strip()
    port = int(cred.smtp_port or 587)
    use_tls = bool(cred.smtp_use_tls)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=25) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(from_email, password)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP_SSL(host, port, timeout=25) as server:
                server.login(from_email, password)
                server.sendmail(from_email, [to_email], msg.as_string())
        return True, "تم الإرسال بنجاح"
    except smtplib.SMTPAuthenticationError:
        return False, "فشل مصادقة SMTP — تحقق من البريد وكلمة مرور التطبيق (Gmail App Password)"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:300]


def send_system_email(to_email: str, subject: str, body_text: str, body_html: str | None = None) -> tuple[bool, str]:
    cred = get_active_email_smtp()
    if not cred:
        return False, "لم يُكوَّن بريد SMTP — أضِف تكامل Gmail من لوحة مدير النظام"
    return send_smtp_email(cred, to_email, subject, body_text, body_html)
