from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/summary/', views.SummaryView.as_view()),
    path('dashboard/recent-projects/', views.RecentProjectsView.as_view()),
    path('dashboard/activity/', views.ActivityView.as_view()),
    path('dashboard/storage/', views.StorageView.as_view()),
    path('projects/', views.RecentProjectsView.as_view()),
    path('projects/bulk-actions/', views.ProjectBulkActionsView.as_view()),
    path('projects/<uuid:pk>/', views.ProjectDetailView.as_view()),
    path('folders/', views.FoldersView.as_view()),
    path('folders/<uuid:pk>/', views.FolderDetailView.as_view()),
    path('project-folders/', views.FoldersView.as_view()),
    path('project-folders/<uuid:pk>/', views.FolderDetailView.as_view()),
    path('notifications/', views.NotificationsView.as_view()),
    path('notifications/read-all/', views.NotificationsReadAllView.as_view()),
    path('notifications/<uuid:pk>/', views.NotificationDetailView.as_view()),
]
for action in ['duplicate', 'delete', 'restore']:
    urlpatterns.append(path(f'projects/<uuid:pk>/{action}/', views.ProjectActionView.as_view(), {'action': action}))
