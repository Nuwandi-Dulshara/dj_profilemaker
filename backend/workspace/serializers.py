from django.utils import timezone
from rest_framework import serializers
from .models import Activity, DocumentSnapshot, ExportEvent, Folder, Notification, Project, PublicShareLink

TRASH_RETENTION_DAYS = 30


class ProjectSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', default=None, read_only=True)
    parent_title = serializers.CharField(source='parent_project.title', default=None, read_only=True)
    variant_count = serializers.SerializerMethodField()
    trash_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'kind', 'folder', 'folder_name',
            'parent_project', 'parent_title', 'target_role', 'variant_count',
            'favorite', 'archived', 'deleted_at', 'trash_days_remaining',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'kind', 'parent_project', 'deleted_at', 'created_at', 'updated_at']

    def get_variant_count(self, obj):
        if hasattr(obj, 'active_variant_count'):
            return obj.active_variant_count
        return obj.variants.filter(deleted_at__isnull=True).count()

    def get_trash_days_remaining(self, obj):
        if not obj.deleted_at:
            return None
        elapsed = (timezone.now() - obj.deleted_at).days
        return max(0, TRASH_RETENTION_DAYS - elapsed)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context.get('user')
        self.fields['folder'].queryset = Folder.objects.filter(owner=user) if user else Folder.objects.none()

    def validate_title(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Project title cannot be blank.')
        return cleaned


class ProjectCreateSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', default=None, read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'title', 'kind', 'folder', 'folder_name', 'favorite', 'archived', 'deleted_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'deleted_at', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context.get('user')
        self.fields['folder'].queryset = Folder.objects.filter(owner=user) if user else Folder.objects.none()

    def validate_title(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Project title cannot be blank.')
        return cleaned


class FolderSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', default=None, read_only=True)
    project_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'parent_name', 'project_count']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context.get('user')
        self.fields['parent'].queryset = Folder.objects.filter(owner=user) if user else Folder.objects.none()

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Folder name cannot be blank.')
        return cleaned

    def validate(self, attrs):
        parent = attrs.get('parent', getattr(self.instance, 'parent', None))
        if self.instance and parent is not None:
            if parent.pk == self.instance.pk:
                raise serializers.ValidationError({'parent': 'A folder cannot be moved into itself.'})
            curr = parent.parent
            visited = {self.instance.pk, parent.pk}
            while curr is not None:
                if curr.pk in visited:
                    raise serializers.ValidationError({'parent': 'Cannot move a folder into one of its subfolders.'})
                visited.add(curr.pk)
                curr = curr.parent
        return attrs


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ['id', 'project', 'title', 'action', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'kind', 'title', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'kind', 'title', 'message', 'created_at']


class DocumentSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentSnapshot
        fields = ['id', 'revision', 'title', 'content', 'design', 'created_at']


class PublicShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicShareLink
        fields = ['token', 'is_active', 'created_at', 'updated_at']


class ExportEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExportEvent
        fields = ['id', 'format', 'created_at']
