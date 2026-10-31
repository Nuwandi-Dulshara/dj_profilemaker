import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify


class Profile(models.Model):
    TEMPLATE_CHOICES = [
        ("professional", "Professional"),
        ("creative", "Creative"),
        ("minimal", "Minimal"),
        ("modern", "Modern"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="profiles")
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    photo = models.ImageField(upload_to="profiles/", blank=True, null=True)
    template_id = models.CharField(max_length=50, choices=TEMPLATE_CHOICES, default="professional")
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    @staticmethod
    def generate_unique_slug(name, instance=None):
        base_slug = slugify(name) or "profile"
        slug = base_slug
        counter = 2
        qs = Profile.objects.all()
        if instance and instance.pk:
            qs = qs.exclude(pk=instance.pk)
        while qs.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug


class Skill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=150)
    level = models.PositiveSmallIntegerField(default=80)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.name} ({self.level}%)"


class SocialLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="links")
    platform = models.CharField(max_length=50)
    url = models.URLField(max_length=500)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.platform}: {self.url}"
