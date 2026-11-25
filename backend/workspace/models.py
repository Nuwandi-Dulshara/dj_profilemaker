import uuid
from django.conf import settings
from django.db import models


class Folder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')

    class Meta:
        ordering = ['name', 'id']
        constraints = [models.UniqueConstraint(fields=['owner', 'name'], name='workspace_unique_folder_name')]


class Project(models.Model):
    class Kind(models.TextChoices):
        ADVANCED_CV = 'advanced_cv', 'Advanced CV'
        COVER_LETTER = 'cover_letter', 'Cover letter'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL)
    parent_project = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='variants')
    target_role = models.CharField(max_length=150, blank=True, default='')
    favorite = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [models.Index(fields=['owner', 'deleted_at', '-updated_at'])]


class Document(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='document')
    schema_version = models.PositiveIntegerField(default=1)
    content = models.JSONField(default=dict)
    design = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=1)


class CareerProfile(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    personal = models.JSONField(default=dict)
    summary = models.TextField(blank=True)
    experience = models.JSONField(default=list)
    education = models.JSONField(default=list)
    skills = models.JSONField(default=list)
    projects = models.JSONField(default=list)
    certifications = models.JSONField(default=list)
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)


class Activity(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=200)
    action = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['owner', '-created_at'])]


class Notification(models.Model):
    class Kind(models.TextChoices):
        EXPORT = 'export', 'Export'
        AUTOSAVE = 'autosave', 'Autosave'
        COMMENT = 'comment', 'Comment'
        FEEDBACK = 'feedback', 'Feedback'
        IMPORTANT = 'important', 'Important'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['owner', 'is_read', '-created_at'])]


class DocumentSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='snapshots')
    revision = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content = models.JSONField(default=dict)
    design = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-revision', '-created_at']
        indexes = [models.Index(fields=['project', '-revision'])]


class PublicShareLink(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='share_link')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ExportEvent(models.Model):
    class Format(models.TextChoices):
        PDF = 'pdf', 'PDF'
        DOCX = 'docx', 'DOCX'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='export_events')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    format = models.CharField(max_length=10, choices=Format.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['project', '-created_at'])]

