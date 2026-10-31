from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "name"]


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        cleaned_email = value.strip().lower()
        if User.objects.filter(email__iexact=cleaned_email).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return cleaned_email

    def create(self, validated_data):
        email = validated_data["email"].strip().lower()
        name = validated_data["name"].strip()
        password = validated_data["password"]

        # Use email as username or derive unique username
        username = email
        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=name,
            password=password
        )
        token, _ = Token.objects.get_or_create(user=user)
        return user, token


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        # In Django User, username might equal email
        user = None
        try:
            user_obj = User.objects.get(email__iexact=email)
            user = authenticate(username=user_obj.username, password=password)
        except User.DoesNotExist:
            user = None

        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This user account is disabled.")

        token, _ = Token.objects.get_or_create(user=user)
        attrs["user"] = user
        attrs["token"] = token
        return attrs
