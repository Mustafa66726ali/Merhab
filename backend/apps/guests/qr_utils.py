"""توليد رمز QR الخاص بكل ضيف.

يُرمَّز داخل الـ QR رمزُ الدعوة الفريد (public_token) فقط، وهو ما يقرؤه ماسح
النظام (تسجيل الحضور / الإجلاس) ليطابق الضيف عبر نقاط النهاية المخصصة.
"""

from io import BytesIO

import qrcode
from django.core.files.base import ContentFile


def build_guest_qr_png(token: str) -> bytes:
    """يُنشئ صورة PNG لرمز QR يحمل رمز الدعوة الفريد."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(str(token))
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1c1b28", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def ensure_guest_qr(guest, force: bool = False):
    """يولّد ويحفظ صورة QR للضيف إن لم تكن موجودة (أو عند force)."""
    if guest.qr_code and not force:
        return guest.qr_code
    png = build_guest_qr_png(guest.public_token)
    guest.qr_code.save(
        f"guest_{guest.public_token}.png",
        ContentFile(png),
        save=False,
    )
    guest.save(update_fields=["qr_code"])
    return guest.qr_code
