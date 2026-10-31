from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from profiles.views import PublicProfileView


def api_home(request):
    return JsonResponse({
        "status": "success",
        "message": "Profile Studio Pro API is running",
        "version": "1.0",
        "endpoints": {
            "auth": "/api/auth/",
            "profiles": "/api/profiles/",
            "public_profile": "/api/public/p/<slug>/",
        }
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_home, name="api-home"),
    path("api/auth/", include("accounts.urls")),
    path("api/profiles/", include("profiles.urls")),
    path("api/public/p/<slug:slug>/", PublicProfileView.as_view(), name="public-profile-direct"),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )