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
        TEMPLATE_CV = 'template_cv', 'Template-based CV'
        COVER_LETTER = 'cover_letter', 'Cover letter'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL)
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


class DocumentVersion(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    name = models.CharField(max_length=120)
    content = models.JSONField(default=dict)
    design = models.JSONField(default=dict)
    revision = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['document', '-created_at'])]


class CareerProfile(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    summary = models.TextField(blank=True)
    experience = models.JSONField(default=list)
    education = models.JSONField(default=list)
    skills = models.JSONField(default=list)
    projects = models.JSONField(default=list)
    certifications = models.JSONField(default=list)


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


class SavedTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=500, blank=True)
    design = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class TemplatePreference(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    template_id = models.CharField(max_length=80)
    favorite = models.BooleanField(default=False)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'template_id'], name='workspace_unique_template_preference')]


class TemplateCreation(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.UUIDField()
    fingerprint = models.CharField(max_length=64)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'key'], name='workspace_unique_template_creation')]
