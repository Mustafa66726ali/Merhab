"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Accordion } from "react-bootstrap";
import { motion } from "framer-motion";
import {
  FaFacebook,
  FaWhatsapp,
  FaInstagram,
  FaYoutube,
  FaXTwitter,
  FaLinkedin,
  FaTelegram,
  FaTiktok,
  FaSnapchat,
} from "react-icons/fa6";
import AnnouncementBannerSlider from "@/components/landing/AnnouncementBannerSlider";
import AnnouncementVideoCarousel from "@/components/landing/AnnouncementVideoCarousel";
import {
  publicMediaAPI,
  faqAPI,
  type PublicSitePayload,
  type PublicMediaItem,
  type LandingSiteConfig,
  type PublicFAQItem,
  type PublicStaticPageListItem,
} from "@/lib/api";

const UTILITY_SLUG_ORDER = [
  "about-us",
  "privacy-policy",
  "terms-of-use",
  "refund-policy",
  "contact",
];

const SOCIAL_TYPES = new Set([
  "facebook",
  "whatsapp",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "telegram",
  "snapchat",
]);

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FaFacebook,
  whatsapp: FaWhatsapp,
  instagram: FaInstagram,
  twitter: FaXTwitter,
  linkedin: FaLinkedin,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  telegram: FaTelegram,
  snapchat: FaSnapchat,
};

function MsIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined landing-ms-icon ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function SocialLinkIcon({ linkType, className = "w-4 h-4" }: { linkType: string; className?: string }) {
  const Icon = SOCIAL_ICONS[linkType];
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  return <MsIcon name="link" className={className} />;
}

function collectUtilityPages(
  headerPages: PublicStaticPageListItem[],
  footerPages: PublicStaticPageListItem[],
  landingPages: PublicStaticPageListItem[]
) {
  const map = new Map<string, PublicStaticPageListItem>();
  for (const p of [...headerPages, ...footerPages, ...landingPages]) {
    if (p.show_in_header || UTILITY_SLUG_ORDER.includes(p.slug)) {
      map.set(p.slug, p);
    }
  }
  const ordered = UTILITY_SLUG_ORDER.filter((slug) => map.has(slug)).map((slug) => map.get(slug)!);
  Array.from(map.values()).forEach((p) => {
    if (!UTILITY_SLUG_ORDER.includes(p.slug)) ordered.push(p);
  });
  return ordered;
}

const emptyConfig: LandingSiteConfig = {
  hero_title: "مرحّاب",
  hero_subtitle: "",
  hero_description: "",
  hero_cta_primary: "ابدأ الآن",
  hero_cta_primary_url: "",
  hero_cta_secondary: "تعرف علينا",
  hero_cta_secondary_url: "#about",
  stats: [],
  features: [],
  testimonials: [],
  partners_title: "",
  gallery_title: "معرض المناسبات",
  video_section_title: "شاهد مرحّاب",
  contact_email: "",
  contact_phone: "",
  meta_title: "مرحّاب",
  meta_description: "",
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function isExternal(url: string) {
  return url.startsWith("http") || url.startsWith("//");
}

function normalizeWhatsAppUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.includes("wa.me") || trimmed.includes("api.whatsapp.com")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8) return `https://wa.me/${digits}`;
  return trimmed;
}

function pickWhatsAppUrl(
  externalLinks: { url: string; link_type: string }[],
  adminUrl?: string
): string | null {
  if (adminUrl?.trim()) return normalizeWhatsAppUrl(adminUrl);
  const wa = externalLinks.find((l) => l.link_type === "whatsapp");
  return wa?.url ? normalizeWhatsAppUrl(wa.url) : null;
}

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SmartLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          scrollToHash(href);
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function CtaButton({
  href,
  children,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const cls = primary ? "landing-btn-primary" : "landing-btn-ghost";
  return (
    <SmartLink href={href} className={cls}>
      {children}
    </SmartLink>
  );
}

function SectionHeader({
  badge,
  title,
  subtitle,
  align = "center",
}: {
  badge: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-right";
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{ duration: 0.5 }}
      className={`mb-10 sm:mb-12 ${alignCls}`}
    >
      <span className="landing-section-badge mb-4">
        <MsIcon name="auto_awesome" className="!text-sm" />
        {badge}
      </span>
      <h2 className={`landing-section-title ${align === "center" ? "mx-auto" : ""}`}>{title}</h2>
      {subtitle && (
        <p className={`landing-section-subtitle mt-3 ${align === "center" ? "mx-auto" : ""}`}>{subtitle}</p>
      )}
    </motion.div>
  );
}

function MediaVideo({ item, className = "" }: { item: PublicMediaItem; className?: string }) {
  if (item.embed_url) {
    return (
      <div
        className={`relative w-full aspect-video rounded-2xl overflow-hidden border border-outline-variant/20 bg-black shadow-2xl shadow-primary-container/10 ${className}`}
      >
        <iframe
          src={item.embed_url}
          title={item.title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (item.file_url) {
    return (
      <video
        controls
        className={`w-full rounded-2xl border border-outline-variant/20 shadow-xl ${className}`}
        poster={item.thumbnail_url || undefined}
      >
        <source src={item.file_url} />
      </video>
    );
  }
  return null;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function LandingPageView() {
  const [site, setSite] = useState<PublicSitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [faqForm, setFaqForm] = useState({ question: "", asker_name: "", asker_email: "" });
  const [faqSubmitting, setFaqSubmitting] = useState(false);
  const [faqMessage, setFaqMessage] = useState("");

  const [reviewForm, setReviewForm] = useState({ name: "", role: "", text: "", email: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 12);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("landing-scroll");
    window.addEventListener("scroll", onScroll, { passive: true });
    publicMediaAPI
      .publicSite()
      .then((res) => setSite(res.data))
      .catch(() => setSite({ published: false }))
      .finally(() => setLoading(false));

    return () => {
      document.documentElement.classList.remove("landing-scroll");
      window.removeEventListener("scroll", onScroll);
    };
  }, [onScroll]);

  useEffect(() => {
    document.body.style.overflow = mobileNav ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNav]);

  const utilityPages = useMemo(() => {
    if (!site?.published || !site.config) return [];
    return collectUtilityPages(
      site.header_pages ?? [],
      site.footer_pages ?? [],
      site.static_pages ?? []
    );
  }, [site]);

  const socialLinks = useMemo(() => {
    if (!site?.published) return [];
    return (site.external_links ?? []).filter((l) => SOCIAL_TYPES.has(l.link_type));
  }, [site]);

  const submitFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question.trim()) return;
    setFaqSubmitting(true);
    setFaqMessage("");
    try {
      const res = await faqAPI.submitQuestion({
        question: faqForm.question.trim(),
        asker_name: faqForm.asker_name.trim(),
        asker_email: faqForm.asker_email.trim(),
      });
      setFaqMessage(res.data.message);
      setFaqForm({ question: "", asker_name: "", asker_email: "" });
    } catch {
      setFaqMessage("تعذر إرسال السؤال. حاول مرة أخرى.");
    } finally {
      setFaqSubmitting(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.name.trim() || !reviewForm.text.trim()) return;
    setReviewSubmitting(true);
    setReviewMessage("");
    try {
      const res = await publicMediaAPI.submitTestimonial({
        name: reviewForm.name.trim(),
        role: reviewForm.role.trim(),
        text: reviewForm.text.trim(),
        email: reviewForm.email.trim(),
      });
      setReviewMessage(res.data.message);
      setReviewForm({ name: "", role: "", text: "", email: "" });
    } catch {
      setReviewMessage("تعذر إرسال الرأي. حاول مرة أخرى.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-container to-[#7b52ff] flex items-center justify-center shadow-lg shadow-primary-container/40"
          >
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              diamond
            </span>
          </motion.div>
          <span className="animate-spin w-9 h-9 border-4 border-primary-container border-t-transparent rounded-full" />
          <p className="text-sm text-on-surface-variant">جاري تحميل صفحة الهبوط...</p>
        </div>
      </div>
    );
  }

  if (!site?.published || !site.config) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-outline/40">web_asset_off</span>
        </div>
        <p className="text-on-surface-variant text-lg">{site?.message || "صفحة الهبوط غير متاحة حالياً"}</p>
      </div>
    );
  }

  const config = site.config ?? emptyConfig;
  const heroMedia = site.media?.hero?.[0];
  const gallery = site.media?.gallery ?? [];
  const videos = site.media?.video ?? [];
  const footerPages = site.footer_pages ?? [];
  const staticPages = site.static_pages ?? [];
  const externalLinks = site.external_links ?? [];
  const faqItems: PublicFAQItem[] = site.faq ?? [];
  const testimonials = config.testimonials ?? [];
  const announcementBanners = site.announcement_banners ?? [];
  const announcementVideos = site.announcement_videos ?? [];

  const whatsappUrl = pickWhatsAppUrl(externalLinks, site.admin_whatsapp_url);
  const primaryCtaUrl = whatsappUrl || config.hero_cta_primary_url || "#";
  const secondaryCtaUrl = "#about";

  const allStaticPageRefs = (() => {
    const map = new Map<string, PublicStaticPageListItem>();
    for (const p of [
      ...staticPages,
      ...footerPages,
      ...(site.header_pages ?? []),
    ]) {
      map.set(p.slug, p);
    }
    return Array.from(map.values());
  })();

  const aboutUsPage = allStaticPageRefs.find(
    (p) => p.slug === "about-us" || p.page_type === "about_us"
  );
  const aboutSectionPages =
    staticPages.length > 0
      ? staticPages
      : aboutUsPage
        ? [aboutUsPage]
        : [];

  const navLinks = [
    ...(announcementBanners.length > 0 ? [{ href: "#announcements", label: "الإعلانات" }] : []),
    { href: "#features", label: "المميزات" },
    { href: "#gallery", label: "المعرض" },
    { href: "#about", label: "من نحن" },
    { href: "#faq", label: "الأسئلة" },
    { href: "#reviews", label: "آراء العملاء" },
  ];

  return (
    <div className="landing-page min-h-screen relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="landing-glow w-[500px] h-[500px] bg-primary-container top-[-10%] left-[20%]" />
        <div className="landing-glow w-[400px] h-[400px] bg-[#7b52ff] bottom-[10%] right-[-5%] opacity-20" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#c8bfff 1px, transparent 1px), linear-gradient(90deg, #c8bfff 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Mobile overlay */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden="true"
        />
      )}

      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-surface-container-lowest/95 backdrop-blur-xl border-b border-outline-variant/20 shadow-lg shadow-black/20"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="row align-items-center py-3 sm:py-4 g-2">
            <div className="col-auto">
              <Link href="/landing" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary-container to-[#7b52ff] shadow-lg shadow-primary-container/30 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    diamond
                  </span>
                </div>
                <div className="hidden sm:block">
                  <span className="font-extrabold text-lg font-headline block leading-tight">مرحّاب</span>
                  <span className="text-[10px] text-on-surface-variant">إدارة المناسبات</span>
                </div>
              </Link>
            </div>

            <div className="col d-none d-lg-block">
              <nav className="d-flex justify-center gap-1">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => {
                      if (l.href.startsWith("#")) {
                        e.preventDefault();
                        scrollToHash(l.href);
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-colors no-underline"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="col-auto d-flex align-items-center gap-2 ms-auto">
              <Link
                href="/login"
                className="landing-btn-primary !py-2 !px-3 sm:!px-4 !text-xs sm:!text-sm inline-flex items-center gap-1.5"
              >
                <MsIcon name="login" className="!text-base" />
                <span>تسجيل الدخول</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1.5">
                {utilityPages.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/pages/${p.slug}`}
                    className="landing-icon-btn"
                    title={p.title}
                    aria-label={p.title}
                  >
                    <MsIcon name={p.display_icon || "article"} />
                  </Link>
                ))}
                {socialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-icon-btn"
                    title={link.title}
                    aria-label={link.title}
                  >
                    <SocialLinkIcon linkType={link.link_type} />
                  </a>
                ))}
              </div>
              <button
                type="button"
                className="lg:hidden p-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/20"
                onClick={() => setMobileNav(true)}
                aria-label="فتح القائمة"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        <aside
          className={`fixed top-0 right-0 h-full w-[min(300px,88vw)] z-50 bg-surface-container-low border-l border-outline-variant/20 shadow-2xl transition-transform duration-300 lg:hidden ${
            mobileNav ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-5 border-b border-outline-variant/15 flex items-center justify-between">
            <span className="font-bold font-headline">القائمة</span>
            <button type="button" onClick={() => setMobileNav(false)} className="p-2 rounded-lg hover:bg-surface-container-high">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <nav className="p-4 flex flex-col gap-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => {
                  if (l.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToHash(l.href);
                  }
                  setMobileNav(false);
                }}
                className="px-4 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-primary-container/10 hover:text-primary transition-colors no-underline"
              >
                {l.label}
              </a>
            ))}
            {utilityPages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/15">
                <p className="text-xs font-bold text-outline px-4 mb-2">صفحات مهمة</p>
                <div className="flex flex-wrap gap-2 px-2">
                  {utilityPages.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/pages/${p.slug}`}
                      onClick={() => setMobileNav(false)}
                      className="landing-icon-btn"
                      title={p.title}
                      aria-label={p.title}
                    >
                      <MsIcon name={p.display_icon || "article"} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {socialLinks.length > 0 && (
              <div className="mt-3 px-2 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-icon-btn"
                    title={link.title}
                    aria-label={link.title}
                  >
                    <SocialLinkIcon linkType={link.link_type} />
                  </a>
                ))}
              </div>
            )}
            <Link
              href="/login"
              onClick={() => setMobileNav(false)}
              className="mt-4 landing-btn-primary w-full justify-center inline-flex items-center gap-2"
            >
              <MsIcon name="login" className="!text-base" />
              تسجيل الدخول
            </Link>
          </nav>
        </aside>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative pt-8 sm:pt-12 pb-4 sm:pb-8">
          {heroMedia?.file_url && heroMedia.media_type === "image" && (
            <div
              className="absolute inset-0 opacity-[0.12] mask-image-gradient"
              style={{
                backgroundImage: `url(${heroMedia.file_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-surface-container-lowest/40 via-surface-container-lowest/90 to-surface-container-lowest" />

          <div className="container max-w-6xl relative px-4 sm:px-6">
            <div className="row align-items-center g-5 lg:g-8">
              <div className="col-lg-7">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ duration: 0.6 }}
                >
                  <span className="landing-section-badge mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    منصة سعودية لإدارة المناسبات
                  </span>
                  <h1
                    className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold font-headline leading-[1.15] mb-5"
                    style={{
                      background: "linear-gradient(135deg, #c8bfff 0%, #e5deff 45%, #ffffff 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {config.hero_title}
                  </h1>
                  <p className="text-base sm:text-xl text-on-surface-variant leading-relaxed mb-3 max-w-xl">
                    {config.hero_subtitle}
                  </p>
                  {config.hero_description && (
                    <p className="text-sm text-outline mb-8 max-w-lg leading-relaxed">{config.hero_description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mb-2">
                    <CtaButton href={primaryCtaUrl} primary>
                      <MsIcon name="rocket_launch" className="!text-lg" />
                      {config.hero_cta_primary}
                    </CtaButton>
                    <CtaButton href={secondaryCtaUrl}>
                      <MsIcon name="explore" className="!text-lg" />
                      {config.hero_cta_secondary}
                    </CtaButton>
                  </div>
                </motion.div>
              </div>

              <div className="col-lg-5">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  className="relative"
                >
                  <div className="absolute -inset-4 bg-primary-container/20 rounded-3xl blur-2xl" />
                  <div className="landing-card p-2 sm:p-3 relative overflow-hidden">
                    {heroMedia && heroMedia.media_type !== "image" ? (
                      <MediaVideo item={heroMedia} />
                    ) : heroMedia?.file_url ? (
                      <img
                        src={heroMedia.file_url}
                        alt={heroMedia.alt_text || heroMedia.title}
                        className="w-full rounded-xl aspect-[4/3] object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-primary-container/20 to-surface-container-high flex items-center justify-center border border-outline-variant/10">
                        <div className="text-center p-6">
                          <span className="material-symbols-outlined text-5xl text-primary mb-3 block">celebration</span>
                          <p className="text-sm font-bold text-on-surface-variant">منصة متكاملة للمناسبات</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {announcementBanners.length > 0 && (
          <AnnouncementBannerSlider items={announcementBanners} />
        )}

        {announcementVideos.length > 0 && (
          <AnnouncementVideoCarousel items={announcementVideos} />
        )}

        {/* Features */}
        {config.features.length > 0 && (
          <section id="features" className="container max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
            <SectionHeader
              badge="المميزات"
              title="لماذا مرحّاب؟"
              subtitle="حلول ذكية تجمع الدعوات، الضيوف، RSVP، والتقارير في تجربة واحدة سلسة"
            />
            <div className="row g-4">
              {config.features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="col-sm-6 col-lg-4"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                >
                  <div className="landing-card landing-card-hover h-100 p-5 sm:p-6 group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-container/25 to-primary-container/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                      </div>
                      <span className="text-[10px] font-bold text-outline tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 font-headline">{f.title}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-0">{f.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <section id="gallery" className="py-16 sm:py-24 border-y border-outline-variant/10 bg-surface-container-low/40">
            <div className="container max-w-6xl px-4 sm:px-6">
              <SectionHeader badge="المعرض" title={config.gallery_title} subtitle="لقطات من مناسبات نُظمت عبر مرحّاب" />
              <div className="row g-3 sm:g-4">
                {gallery.map((item, i) => (
                  <motion.div
                    key={item.id}
                    className={i === 0 && gallery.length > 2 ? "col-12 col-md-8" : "col-6 col-md-4"}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <figure
                      className={`group relative rounded-2xl overflow-hidden border border-outline-variant/15 bg-surface-container-low m-0 ${
                        i === 0 && gallery.length > 2 ? "aspect-[16/9] sm:aspect-[21/9]" : "aspect-square"
                      }`}
                    >
                      {item.file_url ? (
                        <img
                          src={item.file_url}
                          alt={item.alt_text || item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline">
                          <span className="material-symbols-outlined text-4xl">image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <figcaption className="absolute bottom-0 inset-x-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-sm font-bold text-white m-0">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-white/70 mt-1 m-0 line-clamp-1">{item.description}</p>
                        )}
                      </figcaption>
                    </figure>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <section className="container max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
            <SectionHeader badge="فيديو" title={config.video_section_title} subtitle="شاهد كيف تُبسّط مرحّاب تنظيم مناسباتك" />
            <div className="row g-4 g-lg-5">
              {videos.map((item, i) => (
                <motion.div
                  key={item.id}
                  className="col-lg-6"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="landing-card p-3 sm:p-4">
                    <MediaVideo item={item} />
                    {item.title && <p className="text-sm font-bold mt-4 mb-1">{item.title}</p>}
                    {item.description && <p className="text-xs text-on-surface-variant mb-0">{item.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* About / من نحن */}
        {(aboutSectionPages.length > 0 || aboutUsPage) && (
          <section id="about" className="py-16 sm:py-24 bg-surface-container-low/30 border-y border-outline-variant/10">
            <div className="container max-w-6xl px-4 sm:px-6">
              <SectionHeader
                badge="عن المنصة"
                title={aboutUsPage?.title ?? "من نحن"}
                subtitle={
                  aboutUsPage?.subtitle ||
                  "تعرف على مرحّاب وصفحات ومعلومات تساعدك على فهم المنصة وخدماتها"
                }
              />
              <div className="row g-4">
                {aboutSectionPages.map((page, i) => (
                  <motion.div
                    key={page.slug}
                    className="col-sm-6 col-lg-4"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Link
                      href={`/pages/${page.slug}`}
                      className="landing-card landing-card-hover d-block h-100 p-5 text-decoration-none group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary-container/15 flex items-center justify-center mb-4 group-hover:bg-primary-container/25 transition-colors">
                        <span className="material-symbols-outlined text-primary text-2xl">{page.display_icon}</span>
                      </div>
                      <h3 className="font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">
                        {page.title}
                      </h3>
                      {page.subtitle && (
                        <p className="text-sm text-on-surface-variant mb-4 line-clamp-2">{page.subtitle}</p>
                      )}
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        اقرأ المزيد
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="py-16 sm:py-24">
          <div className="container max-w-6xl px-4 sm:px-6">
            <SectionHeader
              badge="الدعم"
              title="الأسئلة والاستفسارات"
              subtitle="تصفح الأسئلة الشائعة أو اطرح سؤالك — نرد عليك من لوحة الإدارة"
            />
            <div className="row g-5 align-items-start">
              <div className="col-lg-7">
                {faqItems.length > 0 ? (
                  <Accordion className="landing-accordion" flush>
                    {faqItems.map((item, idx) => (
                      <Accordion.Item key={item.id} eventKey={String(idx)}>
                        <Accordion.Header>{item.question}</Accordion.Header>
                        <Accordion.Body>{item.answer}</Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                ) : (
                  <div className="landing-card p-8 sm:p-10 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline/40 mb-3 block">forum</span>
                    <p className="text-on-surface-variant text-sm">لا توجد أسئلة منشورة بعد. كن أول من يطرح سؤالاً!</p>
                  </div>
                )}
              </div>
              <div className="col-lg-5">
                <div className="landing-card p-5 sm:p-6 sticky top-24 border-primary-container/20">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-primary-container/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">help</span>
                    </div>
                    <div>
                      <h3 className="font-bold mb-0">اطرح سؤالك</h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">سيتم الرد من قسم الأسئلة</p>
                    </div>
                  </div>
                  <form onSubmit={submitFaq} className="space-y-3">
                    <input
                      className="landing-input"
                      placeholder="اسمك (اختياري)"
                      value={faqForm.asker_name}
                      onChange={(e) => setFaqForm({ ...faqForm, asker_name: e.target.value })}
                    />
                    <input
                      className="landing-input"
                      type="email"
                      dir="ltr"
                      placeholder="بريدك (اختياري)"
                      value={faqForm.asker_email}
                      onChange={(e) => setFaqForm({ ...faqForm, asker_email: e.target.value })}
                    />
                    <textarea
                      className="landing-input min-h-[110px] resize-none"
                      placeholder="اكتب سؤالك هنا..."
                      required
                      value={faqForm.question}
                      onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                    />
                    {faqMessage && (
                      <p className="text-sm text-emerald-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        {faqMessage}
                      </p>
                    )}
                    <button type="submit" disabled={faqSubmitting} className="landing-btn-primary w-full disabled:opacity-50">
                      {faqSubmitting ? "جاري الإرسال..." : "إرسال السؤال"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section id="reviews" className="py-16 sm:py-24 bg-surface-container-low/30 border-y border-outline-variant/10">
          <div className="container max-w-6xl px-4 sm:px-6">
            <SectionHeader badge="آراء العملاء" title="ماذا يقول عملاؤنا" subtitle="تجارب حقيقية من منظمي المناسبات والمؤسسات" />

            {testimonials.length > 0 && (
              <div className="landing-testimonial-scroll mb-10 sm:mb-12">
                {testimonials.map((t, i) => (
                  <motion.blockquote
                    key={`${t.name}-${i}`}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    transition={{ delay: i * 0.06 }}
                    className="landing-card p-5 sm:p-6 relative m-0 h-full flex flex-col"
                  >
                    <div className="flex items-center gap-1 mb-4 text-primary">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-5 flex-grow">{t.text}</p>
                    <footer className="flex items-center gap-3 pt-4 border-t border-outline-variant/15">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-container to-[#7b52ff] flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {initials(t.name)}
                      </div>
                      <div>
                        <strong className="text-sm block">{t.name}</strong>
                        {t.role && <span className="text-xs text-outline">{t.role}</span>}
                        {t.source === "visitor" && (
                          <span className="text-[10px] font-bold text-emerald-400 block mt-0.5">عميل موثّق</span>
                        )}
                      </div>
                    </footer>
                  </motion.blockquote>
                ))}
              </div>
            )}

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="max-w-2xl mx-auto"
            >
              <div className="landing-card p-6 sm:p-8 border-primary-container/25 bg-gradient-to-br from-primary-container/10 to-transparent relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary-container/15 blur-[60px] rounded-full -mr-24 -mt-24" />
                <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">rate_review</span>
                    شاركنا رأيك
                  </h3>
                  <p className="text-xs text-on-surface-variant mb-5">يُراجع الرأي قبل عرضه في الصفحة</p>
                  <form onSubmit={submitReview} className="row g-3">
                    <div className="col-sm-6">
                      <input
                        className="landing-input"
                        placeholder="اسمك *"
                        required
                        value={reviewForm.name}
                        onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                      />
                    </div>
                    <div className="col-sm-6">
                      <input
                        className="landing-input"
                        placeholder="صفتك / مؤسستك"
                        value={reviewForm.role}
                        onChange={(e) => setReviewForm({ ...reviewForm, role: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <input
                        className="landing-input"
                        type="email"
                        dir="ltr"
                        placeholder="بريدك (اختياري)"
                        value={reviewForm.email}
                        onChange={(e) => setReviewForm({ ...reviewForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <textarea
                        className="landing-input min-h-[100px] resize-none"
                        placeholder="رأيك عن مرحّاب *"
                        required
                        value={reviewForm.text}
                        onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
                      />
                    </div>
                    {reviewMessage && (
                      <div className="col-12">
                        <p className="text-sm text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          {reviewMessage}
                        </p>
                      </div>
                    )}
                    <div className="col-12">
                      <button type="submit" disabled={reviewSubmitting} className="landing-btn-primary w-full disabled:opacity-50">
                        {reviewSubmitting ? "جاري الإرسال..." : "إرسال الرأي"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="container max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="relative rounded-3xl overflow-hidden border border-primary-container/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-container/25 via-surface-container-low to-surface-container-lowest" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-container/20 blur-[100px] rounded-full" />
            <div className="relative z-10 p-8 sm:p-14 text-center">
              <h2 className="landing-section-title mb-4">جاهز لتنظيم مناسبتك؟</h2>
              <p className="landing-section-subtitle mx-auto mb-8">
                ابدأ الآن واستفد من منصة متكاملة لإدارة الضيوف والدعوات والتقارير — بدون تعقيد.
              </p>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn-primary text-base px-10 inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  {config.hero_cta_primary}
                </a>
              ) : (
                <CtaButton href={primaryCtaUrl} primary>
                  <MsIcon name="rocket_launch" className="!text-lg" />
                  {config.hero_cta_primary}
                </CtaButton>
              )}
              {(config.contact_email || config.contact_phone) && (
                <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-on-surface-variant">
                  {config.contact_email && (
                    <a href={`mailto:${config.contact_email}`} className="hover:text-primary flex items-center gap-2 transition-colors">
                      <span className="w-9 h-9 rounded-lg bg-primary-container/15 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-base">mail</span>
                      </span>
                      {config.contact_email}
                    </a>
                  )}
                  {config.contact_phone && (
                    <span className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-lg bg-primary-container/15 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-base">call</span>
                      </span>
                      {config.contact_phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-outline-variant/15 bg-surface-container-low">
        <div className="container max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
          <div className="row g-8 mb-10">
            <div className="col-lg-4">
              <Link href="/landing" className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-container to-[#7b52ff] flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    diamond
                  </span>
                </div>
                <span className="font-extrabold text-lg font-headline">مرحّاب</span>
              </Link>
              <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
                منصة سعودية متخصصة في إدارة المناسبات والفعاليات للأفراد والمؤسسات.
              </p>
            </div>
            {utilityPages.length > 0 && (
              <div className="col-sm-6 col-lg-4">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-4">صفحات مهمة</h4>
                <div className="flex flex-wrap gap-2">
                  {utilityPages.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/pages/${p.slug}`}
                      className="landing-icon-btn !w-auto !h-auto !px-3 !py-2 gap-2 flex items-center"
                      title={p.title}
                    >
                      <MsIcon name={p.display_icon || "article"} className="!text-base" />
                      <span className="text-xs font-bold">{p.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {(socialLinks.length > 0 || externalLinks.length > 0) && (
              <div className="col-sm-6 col-lg-4">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-4">تواصل معنا</h4>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-icon-btn"
                      title={link.title}
                      aria-label={link.title}
                    >
                      <SocialLinkIcon linkType={link.link_type} />
                    </a>
                  ))}
                  {externalLinks
                    .filter((l) => !SOCIAL_TYPES.has(l.link_type))
                    .map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="landing-icon-btn !w-auto !h-auto !px-3 !py-2 gap-2 flex items-center"
                        title={link.title}
                      >
                        <MsIcon name={link.icon || "link"} className="!text-base" />
                        <span className="text-xs font-bold">{link.title}</span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="pt-6 border-t border-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
            <p className="text-sm text-outline m-0">© {new Date().getFullYear()} مرحّاب — إدارة المناسبات</p>
            <p className="text-xs text-outline m-0">صُنع بعناية في المملكة العربية السعودية</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
