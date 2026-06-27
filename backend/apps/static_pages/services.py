"""قوالب وخدمات الصفحات الثابتة."""

from django.utils import timezone

from apps.static_pages.models import StaticPage

PAGE_TYPE_SLUGS = {
    StaticPage.PageType.ABOUT_US: "about-us",
    StaticPage.PageType.PRIVACY_POLICY: "privacy-policy",
    StaticPage.PageType.TERMS_OF_USE: "terms-of-use",
    StaticPage.PageType.COOKIE_POLICY: "cookie-policy",
    StaticPage.PageType.REFUND_POLICY: "refund-policy",
    StaticPage.PageType.EVENT_GUIDELINES: "event-guidelines",
    StaticPage.PageType.GUEST_POLICY: "guest-policy",
    StaticPage.PageType.CONTACT_INFO: "contact",
    StaticPage.PageType.CUSTOM: "custom",
}

PAGE_TYPE_META = {
    StaticPage.PageType.ABOUT_US: {"icon": "groups", "color": "#5b2eff"},
    StaticPage.PageType.PRIVACY_POLICY: {"icon": "shield", "color": "#4285F4"},
    StaticPage.PageType.TERMS_OF_USE: {"icon": "gavel", "color": "#928ea3"},
    StaticPage.PageType.COOKIE_POLICY: {"icon": "cookie", "color": "#FF9900"},
    StaticPage.PageType.REFUND_POLICY: {"icon": "payments", "color": "#00C48C"},
    StaticPage.PageType.EVENT_GUIDELINES: {"icon": "event", "color": "#5b2eff"},
    StaticPage.PageType.GUEST_POLICY: {"icon": "badge", "color": "#E4405F"},
    StaticPage.PageType.CONTACT_INFO: {"icon": "mail", "color": "#25D366"},
    StaticPage.PageType.CUSTOM: {"icon": "article", "color": "#928ea3"},
}

DEFAULT_TEMPLATES: dict[str, dict] = {
    StaticPage.PageType.ABOUT_US: {
        "title": "من نحن",
        "subtitle": "مرحّاب — منصة إدارة المناسبات والفعاليات",
        "content": (
            "<p>مرحّاب منصة سعودية متخصصة في إدارة المناسبات والفعاليات، "
            "تساعد المنظمين على التخطيط للحفلات والمناسبات الخاصة والفعاليات المؤسسية "
            "من إدارة الضيوف والدعوات حتى المتابعة والتقارير.</p>"
            "<p>نؤمن بأن كل مناسبة تستحق تجربة سلسة واحترافية للمنظم والضيوف.</p>"
        ),
        "meta_title": "من نحن | مرحّاب",
        "meta_description": "تعرف على منصة مرحّاب لإدارة المناسبات والفعاليات في المملكة.",
        "show_in_footer": True,
        "show_in_header": True,
        "show_on_landing": True,
        "sort_order": 1,
    },
    StaticPage.PageType.PRIVACY_POLICY: {
        "title": "سياسة الخصوصية",
        "subtitle": "كيف نحمي بياناتك",
        "content": (
            "<h3>جمع البيانات</h3>"
            "<p>نجمع البيانات الضرورية لتشغيل المنصة: الاسم، البريد، رقم الجوال، "
            "ومعلومات الفعاليات والضيوف عند استخدامك لخدماتنا.</p>"
            "<h3>استخدام البيانات</h3>"
            "<p>تُستخدم البيانات لتقديم الخدمة، إرسال الدعوات والإشعارات، وتحسين تجربة المستخدم. "
            "لا نبيع بياناتك لأطراف ثالثة.</p>"
            "<h3>حماية البيانات</h3>"
            "<p>نطبق معايير أمنية لحماية المعلومات وفق أفضل الممارسات.</p>"
        ),
        "meta_title": "سياسة الخصوصية | مرحّاب",
        "meta_description": "سياسة الخصوصية وكيفية تعامل مرحّاب مع بيانات المستخدمين.",
        "show_in_footer": True,
        "show_in_header": True,
        "sort_order": 2,
    },
    StaticPage.PageType.TERMS_OF_USE: {
        "title": "شروط الاستخدام",
        "subtitle": "القواعد والأحكام",
        "content": (
            "<p>باستخدامك لمنصة مرحّاب، فإنك توافق على الشروط التالية:</p>"
            "<ul>"
            "<li>استخدام المنصة للأغراض المشروعة المتعلقة بإدارة المناسبات.</li>"
            "<li>عدم إساءة استخدام خدمات الدعوات أو الرسائل.</li>"
            "<li>الالتزام بقوانين المملكة العربية السعودية.</li>"
            "<li>مسؤولية المنظم عن محتوى الفعاليات والضيوف المضافين.</li>"
            "</ul>"
        ),
        "meta_title": "شروط الاستخدام | مرحّاب",
        "meta_description": "شروط وأحكام استخدام منصة مرحّاب.",
        "show_in_footer": True,
        "show_in_header": True,
        "sort_order": 3,
    },
    StaticPage.PageType.COOKIE_POLICY: {
        "title": "سياسة ملفات تعريف الارتباط",
        "subtitle": "Cookies",
        "content": (
            "<p>نستخدم ملفات تعريف الارتباط لتحسين تجربة الاستخدام وتذكر تفضيلاتك. "
            "يمكنك إدارة ملفات الارتباط من إعدادات المتصفح.</p>"
        ),
        "show_in_footer": True,
        "sort_order": 4,
    },
    StaticPage.PageType.EVENT_GUIDELINES: {
        "title": "إرشادات المناسبات",
        "subtitle": "نصائح لتنظيم فعالية ناجحة",
        "content": (
            "<p>إرشادات عامة لمنظمي المناسبات على مرحّاب:</p>"
            "<ul>"
            "<li>حدّد عدد الضيوف والميزانية مبكراً.</li>"
            "<li>أرسل الدعوات قبل الموعد بوقت كافٍ.</li>"
            "<li>تابع تأكيدات الحضور (RSVP) بانتظام.</li>"
            "<li>استخدم التقارير لمراجعة أداء الفعالية.</li>"
            "</ul>"
        ),
        "show_on_landing": True,
        "sort_order": 5,
    },
    StaticPage.PageType.GUEST_POLICY: {
        "title": "سياسة الضيوف والحضور",
        "subtitle": "تنظيم قوائم الضيوف والحضور",
        "content": (
            "<p>يتحمل المنظم مسؤولية دقة بيانات الضيوف. "
            "يُسمح للضيوف بالوصول إلى معلومات الفعالية المخصصة لهم فقط.</p>"
        ),
        "show_in_footer": True,
        "sort_order": 6,
    },
    StaticPage.PageType.REFUND_POLICY: {
        "title": "سياسة الاسترداد",
        "subtitle": "الاشتراكات والدفع",
        "content": (
            "<p>تخضع طلبات الاسترداد لشروط الاشتراك المتفق عليها. "
            "تواصل مع الدعم لطلبات الاسترداد خلال المدة المحددة في باقتك.</p>"
        ),
        "show_in_footer": True,
        "show_in_header": True,
        "sort_order": 7,
    },
    StaticPage.PageType.CONTACT_INFO: {
        "title": "تواصل معنا",
        "subtitle": "نحن هنا لمساعدتك",
        "content": (
            "<p>للاستفسارات والدعم الفني:</p>"
            "<ul>"
            "<li>البريد: support@merhab.sa</li>"
            "<li>الموقع: المملكة العربية السعودية</li>"
            "</ul>"
        ),
        "show_in_footer": True,
        "show_in_header": True,
        "show_on_landing": True,
        "sort_order": 8,
    },
}


def get_page_types_catalog() -> list[dict]:
    catalog = []
    for value, label in StaticPage.PageType.choices:
        meta = PAGE_TYPE_META.get(value, {})
        slug = PAGE_TYPE_SLUGS.get(value, "custom")
        has_template = value in DEFAULT_TEMPLATES
        catalog.append({
            "value": value,
            "label": label,
            "slug": slug,
            "icon": meta.get("icon", "article"),
            "color": meta.get("color", "#928ea3"),
            "has_template": has_template,
        })
    return catalog


def compute_stats() -> dict:
    qs = StaticPage.objects.all()
    total = qs.count()
    published = qs.filter(is_published=True).count()
    footer = qs.filter(is_published=True, show_in_footer=True).count()
    landing = qs.filter(is_published=True, show_on_landing=True).count()
    by_type = {}
    for type_value, type_label in StaticPage.PageType.choices:
        type_qs = qs.filter(page_type=type_value)
        by_type[type_value] = {
            "label": type_label,
            "count": type_qs.count(),
            "published": type_qs.filter(is_published=True).count(),
        }
    return {
        "total": total,
        "published": published,
        "draft": total - published,
        "in_footer": footer,
        "on_landing": landing,
        "by_type": by_type,
    }


def seed_default_pages() -> tuple[int, int]:
    created = 0
    updated = 0
    for page_type, template in DEFAULT_TEMPLATES.items():
        slug = PAGE_TYPE_SLUGS[page_type]
        meta = PAGE_TYPE_META.get(page_type, {})
        defaults = {
            **template,
            "page_type": page_type,
            "slug": slug,
            "icon": meta.get("icon", "article"),
            "is_published": False,
        }
        obj, was_created = StaticPage.objects.update_or_create(
            slug=slug,
            defaults=defaults,
        )
        if was_created:
            created += 1
        else:
            updated += 1
    return created, updated


def publish_page(page: StaticPage) -> StaticPage:
    page.is_published = True
    if not page.published_at:
        page.published_at = timezone.now()
    page.save(update_fields=["is_published", "published_at", "updated_at"])
    return page


def unpublish_page(page: StaticPage) -> StaticPage:
    page.is_published = False
    page.save(update_fields=["is_published", "updated_at"])
    return page
