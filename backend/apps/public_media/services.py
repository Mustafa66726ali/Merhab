"""بيانات افتراضية وخدمات صفحة الهبوط."""

from apps.public_media.models import LandingSiteConfig


DEFAULT_FEATURES = [
    {
        "icon": "mail",
        "title": "دعوات ذكية",
        "description": "إرسال دعوات عبر البريد والواتساب مع تتبع RSVP تلقائي.",
    },
    {
        "icon": "groups",
        "title": "إدارة الضيوف",
        "description": "قوائم ضيوف، تأكيد حضور، وتنظيم المقاعد والطاولات.",
    },
    {
        "icon": "analytics",
        "title": "تقارير شاملة",
        "description": "لوحات إحصائيات ومؤشرات أداء لكل فعالية ومنصة.",
    },
    {
        "icon": "hub",
        "title": "منصات متعددة",
        "description": "إدارة عدة منصات ومناسبات من لوحة تحكم موحدة.",
    },
    {
        "icon": "security",
        "title": "أمان وخصوصية",
        "description": "حماية بيانات الضيوف وفق أفضل الممارسات.",
    },
    {
        "icon": "devices",
        "title": "متوافق مع الجوال",
        "description": "تجربة سلسة على الحاسوب والجوال للمنظمين والضيوف.",
    },
]

DEFAULT_TESTIMONIALS = [
    {
        "name": "سارة العتيبي",
        "role": "منظمة حفلات",
        "text": "مرحّاب غيّرت طريقة تنظيم مناسباتي — كل شيء في مكان واحد.",
    },
    {
        "name": "مؤسسة رواد الفعاليات",
        "role": "شركة تنظيم",
        "text": "تقارير RSVP والضيوف ساعدتنا على تحسين تجربة الحضور.",
    },
]


def seed_landing_config() -> LandingSiteConfig:
    config = LandingSiteConfig.get_solo()
    if not config.features:
        config.features = DEFAULT_FEATURES
    if not config.testimonials:
        config.testimonials = DEFAULT_TESTIMONIALS
    config.save()
    return config


def build_public_site_payload(
    config: LandingSiteConfig,
    media_items: list,
    static_pages: list,
    external_links: list,
    footer_pages: list,
    visitor_testimonials: list | None = None,
    faq_items: list | None = None,
) -> dict:
    media_by_section: dict[str, list] = {}
    for item in media_items:
        media_by_section.setdefault(item["section"], []).append(item)

    curated = config.testimonials or []
    visitor = visitor_testimonials or []
    merged_testimonials = list(curated) + [
        {"name": t["name"], "role": t.get("role", ""), "text": t["text"], "source": "visitor"}
        for t in visitor
    ]

    return {
        "config": {
            "hero_title": config.hero_title,
            "hero_subtitle": config.hero_subtitle,
            "hero_description": config.hero_description,
            "hero_cta_primary": config.hero_cta_primary,
            "hero_cta_primary_url": config.hero_cta_primary_url,
            "hero_cta_secondary": config.hero_cta_secondary,
            "hero_cta_secondary_url": config.hero_cta_secondary_url,
            "stats": config.stats or [],
            "features": config.features or [],
            "testimonials": merged_testimonials,
            "partners_title": config.partners_title,
            "gallery_title": config.gallery_title,
            "video_section_title": config.video_section_title,
            "contact_email": config.contact_email,
            "contact_phone": config.contact_phone,
            "meta_title": config.meta_title,
            "meta_description": config.meta_description,
        },
        "media": media_by_section,
        "media_all": media_items,
        "static_pages": static_pages,
        "external_links": external_links,
        "footer_pages": footer_pages,
        "faq": faq_items or [],
    }
