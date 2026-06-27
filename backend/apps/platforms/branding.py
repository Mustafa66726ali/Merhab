"""بيانات الهوية البصرية للمنصة — شعار واسم."""


def platform_logo_url(platform, request=None) -> str:
    if not platform or not platform.logo:
        return ""
    url = platform.logo.url
    if request:
        return request.build_absolute_uri(url)
    return url


def platform_branding_payload(platform, request=None) -> dict:
    return {
        "id": platform.id,
        "name": platform.name,
        "logo_url": platform_logo_url(platform, request),
    }
