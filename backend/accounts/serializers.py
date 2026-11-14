from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name']


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=1024)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': ['Passwords must match.']})
        try:
            validate_password(attrs['password'], self.context.get('user') or User(email=attrs.get('email', ''), first_name=attrs.get('first_name', ''), last_name=attrs.get('last_name', '')))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages}) from exc
        return attrs


class RegisterSerializer(PasswordSerializer, EmailSerializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    accept_policies = serializers.BooleanField()
    policy_version = serializers.CharField(max_length=100)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs['accept_policies'] or attrs['policy_version'] != settings.POLICY_VERSION:
            raise serializers.ValidationError({'accept_policies': ['Accept the current Terms and Privacy Policy.']})
        if User.objects.filter(email__iexact=attrs['email']).exists():
            raise serializers.ValidationError({'email': ['Unable to register with these details. Try signing in or resetting your password.']})
        return attrs


class LoginSerializer(EmailSerializer):
    password = serializers.CharField(trim_whitespace=False, max_length=1024)
    remember_me = serializers.BooleanField(default=False)


class ResetSerializer(PasswordSerializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=256)
