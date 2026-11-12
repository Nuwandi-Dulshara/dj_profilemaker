from django.urls import path
from .views import StatusView, OAuthStartView, OAuthCallbackView, OAuthDisconnectView, DocumentsView, DocumentView, PdfView, ExportView

urlpatterns = [
    path("status/", StatusView.as_view()),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view()),
    path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view()),
    path("oauth/<str:provider>/disconnect/", OAuthDisconnectView.as_view()),
    path("documents/", DocumentsView.as_view()),
    path("documents/<str:ident>/", DocumentView.as_view()),
    path("documents/<str:ident>/pdf/", PdfView.as_view()),
    path("documents/<str:ident>/export/<str:provider>/", ExportView.as_view()),
]
