import base64
import uuid
import re
from django.core.files.base import ContentFile
from rest_framework import serializers
from .models import (
    Profile,
    Skill,
    SocialLink,
    Experience,
    Education,
    Project,
    ContactMessage,
)


class SkillSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)

    class Meta:
        model = Skill
        fields = ["id", "name", "level", "order"]


class SocialLinkSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)

    class Meta:
        model = SocialLink
        fields = ["id", "platform", "url", "order"]


class ExperienceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    startDate = serializers.CharField(source="start_date", required=False, allow_blank=True)
    endDate = serializers.CharField(source="end_date", required=False, allow_blank=True)

    class Meta:
        model = Experience
        fields = ["id", "role", "company", "startDate", "endDate", "current", "description", "order"]


class EducationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    startDate = serializers.CharField(source="start_date", required=False, allow_blank=True)
    endDate = serializers.CharField(source="end_date", required=False, allow_blank=True)
    fieldOfStudy = serializers.CharField(source="field_of_study", required=False, allow_blank=True)

    class Meta:
        model = Education
        fields = ["id", "institution", "degree", "fieldOfStudy", "startDate", "endDate", "order"]


class ProjectSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    demoUrl = serializers.CharField(source="demo_url", required=False, allow_blank=True)
    githubUrl = serializers.CharField(source="github_url", required=False, allow_blank=True)

    class Meta:
        model = Project
        fields = ["id", "title", "description", "demoUrl", "githubUrl", "tags", "order"]


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "sender_name", "sender_email", "subject", "message", "created_at"]
        read_only_fields = ["id", "created_at"]


class Base64ImageField(serializers.ImageField):
    """
    Custom field to handle base64 image strings, existing image URLs, as well as normal uploaded files.
    """

    def to_internal_value(self, data):
        if data in ("", None, "null"):
            return None
        if isinstance(data, str):
            if data.startswith("data:image"):
                try:
                    format_prefix, imgstr = data.split(";base64,")
                    ext = format_prefix.split("/")[-1]
                    if ext == "jpeg":
                        ext = "jpg"
                    file_name = f"{uuid.uuid4().hex[:10]}.{ext}"
                    return ContentFile(base64.b64decode(imgstr), name=file_name)
                except Exception:
                    raise serializers.ValidationError("Invalid base64 image data.")
            if data.startswith("http://") or data.startswith("https://") or data.startswith("/media/"):
                if self.parent and getattr(self.parent, "instance", None):
                    return self.parent.instance.photo
                return None
        return super().to_internal_value(data)


class ProfileSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, required=False)
    links = SocialLinkSerializer(many=True, required=False)
    experiences = ExperienceSerializer(many=True, required=False)
    education = EducationSerializer(many=True, required=False)
    projects = ProjectSerializer(many=True, required=False)
    photo = Base64ImageField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    slug = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Profile
        fields = [
            "id",
            "name",
            "title",
            "bio",
            "email",
            "phone",
            "location",
            "photo",
            "photo_url",
            "template_id",
            "slug",
            "views_count",
            "is_published",
            "skills",
            "links",
            "experiences",
            "education",
            "projects",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "views_count"]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return ""

    def validate_slug(self, value):
        if not value:
            return ""
        sanitized = re.sub(r"[^a-zA-Z0-9-_]", "-", value.lower()).strip("-")
        # Check uniqueness excluding current instance
        qs = Profile.objects.filter(slug=sanitized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This profile slug is already taken. Please choose another.")
        return sanitized

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["photo"] = self.get_photo_url(instance)
        return ret

    def create(self, validated_data):
        skills_data = validated_data.pop("skills", [])
        links_data = validated_data.pop("links", [])
        experiences_data = validated_data.pop("experiences", [])
        education_data = validated_data.pop("education", [])
        projects_data = validated_data.pop("projects", [])
        user = self.context["request"].user

        # Handle custom or auto-generated slug
        slug = validated_data.pop("slug", "")
        if not slug:
            name = validated_data.get("name", "")
            slug = Profile.generate_unique_slug(name)

        validated_data["slug"] = slug
        validated_data["user"] = user

        profile = Profile.objects.create(**validated_data)

        # Save Skills
        for idx, item in enumerate(skills_data):
            Skill.objects.create(
                profile=profile,
                name=item["name"],
                level=item.get("level", 80),
                order=idx,
            )

        # Save Links
        for idx, item in enumerate(links_data):
            SocialLink.objects.create(
                profile=profile,
                platform=item["platform"],
                url=item["url"],
                order=idx,
            )

        # Save Experiences
        for idx, item in enumerate(experiences_data):
            Experience.objects.create(
                profile=profile,
                role=item["role"],
                company=item["company"],
                start_date=item.get("start_date", ""),
                end_date=item.get("end_date", ""),
                current=item.get("current", False),
                description=item.get("description", ""),
                order=idx,
            )

        # Save Education
        for idx, item in enumerate(education_data):
            Education.objects.create(
                profile=profile,
                institution=item["institution"],
                degree=item["degree"],
                field_of_study=item.get("field_of_study", ""),
                start_date=item.get("start_date", ""),
                end_date=item.get("end_date", ""),
                order=idx,
            )

        # Save Projects
        for idx, item in enumerate(projects_data):
            Project.objects.create(
                profile=profile,
                title=item["title"],
                description=item.get("description", ""),
                demo_url=item.get("demo_url", ""),
                github_url=item.get("github_url", ""),
                tags=item.get("tags", ""),
                order=idx,
            )

        return profile

    def update(self, instance, validated_data):
        skills_data = validated_data.pop("skills", None)
        links_data = validated_data.pop("links", None)
        experiences_data = validated_data.pop("experiences", None)
        education_data = validated_data.pop("education", None)
        projects_data = validated_data.pop("projects", None)

        # Update slug if provided or name changed
        custom_slug = validated_data.pop("slug", None)
        if custom_slug:
            instance.slug = custom_slug
        else:
            new_name = validated_data.get("name")
            if new_name and new_name != instance.name:
                instance.slug = Profile.generate_unique_slug(new_name, instance=instance)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Skills
        if skills_data is not None:
            instance.skills.all().delete()
            for idx, item in enumerate(skills_data):
                Skill.objects.create(
                    profile=instance,
                    name=item["name"],
                    level=item.get("level", 80),
                    order=idx,
                )

        # Update Links
        if links_data is not None:
            instance.links.all().delete()
            for idx, item in enumerate(links_data):
                SocialLink.objects.create(
                    profile=instance,
                    platform=item["platform"],
                    url=item["url"],
                    order=idx,
                )

        # Update Experiences
        if experiences_data is not None:
            instance.experiences.all().delete()
            for idx, item in enumerate(experiences_data):
                Experience.objects.create(
                    profile=instance,
                    role=item["role"],
                    company=item["company"],
                    start_date=item.get("start_date", ""),
                    end_date=item.get("end_date", ""),
                    current=item.get("current", False),
                    description=item.get("description", ""),
                    order=idx,
                )

        # Update Education
        if education_data is not None:
            instance.education.all().delete()
            for idx, item in enumerate(education_data):
                Education.objects.create(
                    profile=instance,
                    institution=item["institution"],
                    degree=item["degree"],
                    field_of_study=item.get("field_of_study", ""),
                    start_date=item.get("start_date", ""),
                    end_date=item.get("end_date", ""),
                    order=idx,
                )

        # Update Projects
        if projects_data is not None:
            instance.projects.all().delete()
            for idx, item in enumerate(projects_data):
                Project.objects.create(
                    profile=instance,
                    title=item["title"],
                    description=item.get("description", ""),
                    demo_url=item.get("demo_url", ""),
                    github_url=item.get("github_url", ""),
                    tags=item.get("tags", ""),
                    order=idx,
                )

        return instance
