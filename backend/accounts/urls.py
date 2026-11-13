from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    SettingsUpdateView,
    ForgotPasswordView,
    ResetPasswordView,
    ResendVerificationView,
    CsrfView, BrowserLoginView, BrowserRegisterView,
)

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("session/login/", BrowserLoginView.as_view(), name="session-login"),
    path("session/register/", BrowserRegisterView.as_view(), name="session-register"),
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("settings/", SettingsUpdateView.as_view(), name="auth-settings"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("resend-verification/", ResendVerificationView.as_view(), name="auth-resend-verification"),
]
