from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProfileViewSet, PublicProfileView, DashboardStatsView

router = DefaultRouter()
router.register(r"", ProfileViewSet, basename="profile")

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("public/p/<slug:slug>/", PublicProfileView.as_view(), name="public-profile"),
    path("", include(router.urls)),
]
