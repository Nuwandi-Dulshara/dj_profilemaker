from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .resume_views import ProfileResumeView
from .views import (
    ProfileViewSet,
    PublicProfileView,
    DashboardStatsView,
    ContactMessageCreateView,
)

router = DefaultRouter()
router.register(r"", ProfileViewSet, basename="profile")

urlpatterns = [
    path("resume/", ProfileResumeView.as_view(), name="profile-resume"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("public/p/<slug:slug>/", PublicProfileView.as_view(), name="public-profile"),
    path("public/p/<slug:slug>/contact/", ContactMessageCreateView.as_view(), name="public-profile-contact"),
    path("", include(router.urls)),
]
