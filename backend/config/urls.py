from django.contrib import admin
from django.urls import path
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static


def api_home(request):
    return JsonResponse({
        "status": "success",
        "message": "Profile Studio Pro API is running",
        "version": "1.0",
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_home, name="api-home"),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )