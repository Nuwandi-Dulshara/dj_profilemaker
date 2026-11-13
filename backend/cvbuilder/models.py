import uuid
from django.conf import settings
from django.db import models


class CvAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    drive_id = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    mime = models.CharField(max_length=150)
    size = models.PositiveIntegerField()
    extraction = models.JSONField(default=dict)
    file_id = models.CharField(max_length=255, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)


class CvRevision(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file_id = models.CharField(max_length=255)
    digest = models.CharField(max_length=64)
    source = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'file_id', 'digest'], name='cv_unique_revision')]


class AnalysisRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    file_id = models.CharField(max_length=255, blank=True, db_index=True)
    digest = models.CharField(max_length=64)
    job_description = models.TextField(blank=True)
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class SuggestionRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    digest = models.CharField(max_length=64)
    suggestions = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
