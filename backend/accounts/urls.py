from django.urls import path
from . import views

urlpatterns = [
    path('csrf/', views.CsrfView.as_view()),
    path('config/', views.ConfigView.as_view()),
    path('me/', views.MeView.as_view()),
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('password-reset/', views.PasswordResetView.as_view()),
    path('password-reset/confirm/', views.PasswordResetConfirmView.as_view()),
    path('profile/', views.ProfileView.as_view()),
    path('profile/change-password/', views.ChangePasswordView.as_view()),
    path('preferences/', views.PreferencesView.as_view()),
]
