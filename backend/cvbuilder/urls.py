from django.urls import path
from .views import StatusView, OAuthStartView, OAuthCallbackView, OAuthDisconnectView, DocumentsView, DocumentView, PdfView, ExportView
from .enhancement_views import ImportsView, ImportView, OriginalView, JobDescriptionView, ReconstructView, AnalyzeView, HistoryView, RevisionsView, ImproveView

urlpatterns = [
    path("imports/", ImportsView.as_view()),
    path("imports/<uuid:ident>/", ImportView.as_view()),
    path("imports/<uuid:ident>/original/", OriginalView.as_view()),
    path("job-description/", JobDescriptionView.as_view()),
    path("reconstruct/", ReconstructView.as_view()),
    path("analyze/", AnalyzeView.as_view()),
    path("history/", HistoryView.as_view()),
    path("improve/", ImproveView.as_view()),
    path("documents/<str:ident>/revisions/", RevisionsView.as_view()),
    path("status/", StatusView.as_view()),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view()),
    path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view()),
    path("oauth/<str:provider>/disconnect/", OAuthDisconnectView.as_view()),
    path("documents/", DocumentsView.as_view()),
    path("documents/<str:ident>/", DocumentView.as_view()),
    path("documents/<str:ident>/pdf/", PdfView.as_view()),
    path("documents/<str:ident>/export/<str:provider>/", ExportView.as_view()),
]
