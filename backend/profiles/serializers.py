import base64
import uuid
from django.core.files.base import ContentFile
from rest_framework import serializers
from .models import Profile, Skill, SocialLink


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


class Base64ImageField(serializers.ImageField):
    """
    Custom field to handle base64 image strings, existing image URLs, as well as normal uploaded files.
    """

    def to_internal_value(self, data):
        if data in ("", None, "null"):
            return None
        if isinstance(data, str):
            if data.startswith("data:image"):
                # Format: 'data:image/png;base64,...'
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
                # Existing saved image URL that hasn't changed; retain existing image on instance
                if self.parent and getattr(self.parent, "instance", None):
                    return self.parent.instance.photo
                return None
        return super().to_internal_value(data)


class ProfileSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, required=False)
    links = SocialLinkSerializer(many=True, required=False)
    photo = Base64ImageField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()

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
            "skills",
            "links",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "slug"]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return ""

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure photo output matches the URL format expected by frontend
        ret["photo"] = self.get_photo_url(instance)
        return ret

    def create(self, validated_data):
        skills_data = validated_data.pop("skills", [])
        links_data = validated_data.pop("links", [])
        user = self.context["request"].user

        # Generate unique slug from name
        name = validated_data.get("name", "")
        slug = Profile.generate_unique_slug(name)
        validated_data["slug"] = slug
        validated_data["user"] = user

        profile = Profile.objects.create(**validated_data)

        # Create skills
        for idx, skill_data in enumerate(skills_data):
            skill_id = skill_data.get("id")
            skill_kwargs = {
                "profile": profile,
                "name": skill_data["name"],
                "level": skill_data.get("level", 80),
                "order": idx,
            }
            if skill_id:
                try:
                    uuid.UUID(str(skill_id))
                    skill_kwargs["id"] = skill_id
                except ValueError:
                    pass
            Skill.objects.create(**skill_kwargs)

        # Create social links
        for idx, link_data in enumerate(links_data):
            link_id = link_data.get("id")
            link_kwargs = {
                "profile": profile,
                "platform": link_data["platform"],
                "url": link_data["url"],
                "order": idx,
            }
            if link_id:
                try:
                    uuid.UUID(str(link_id))
                    link_kwargs["id"] = link_id
                except ValueError:
                    pass
            SocialLink.objects.create(**link_kwargs)

        return profile

    def update(self, instance, validated_data):
        skills_data = validated_data.pop("skills", None)
        links_data = validated_data.pop("links", None)

        # Regenerate slug if name changed
        new_name = validated_data.get("name")
        if new_name and new_name != instance.name:
            instance.slug = Profile.generate_unique_slug(new_name, instance=instance)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update skills if passed
        if skills_data is not None:
            instance.skills.all().delete()
            for idx, skill_data in enumerate(skills_data):
                skill_id = skill_data.get("id")
                skill_kwargs = {
                    "profile": instance,
                    "name": skill_data["name"],
                    "level": skill_data.get("level", 80),
                    "order": idx,
                }
                if skill_id:
                    try:
                        uuid.UUID(str(skill_id))
                        skill_kwargs["id"] = skill_id
                    except ValueError:
                        pass
                Skill.objects.create(**skill_kwargs)

        # Update social links if passed
        if links_data is not None:
            instance.links.all().delete()
            for idx, link_data in enumerate(links_data):
                link_id = link_data.get("id")
                link_kwargs = {
                    "profile": instance,
                    "platform": link_data["platform"],
                    "url": link_data["url"],
                    "order": idx,
                }
                if link_id:
                    try:
                        uuid.UUID(str(link_id))
                        link_kwargs["id"] = link_id
                    except ValueError:
                        pass
                SocialLink.objects.create(**link_kwargs)

        return instance
