from rest_framework import serializers
from .models import Activity, Folder, Notification, Project


class ProjectSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', default=None, read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'title', 'kind', 'folder', 'folder_name', 'favorite', 'archived', 'deleted_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'kind', 'deleted_at', 'created_at', 'updated_at']

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
