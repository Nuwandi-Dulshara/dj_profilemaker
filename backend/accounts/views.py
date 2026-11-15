from urllib.parse import urlparse
import logging
from smtplib import SMTPException
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import EmailSerializer, LoginSerializer, RegisterSerializer, ResetSerializer, UserSerializer
from .throttles import AuthThrottle

User = get_user_model()
logger = logging.getLogger(__name__)


def policies_available():
    return bool(settings.POLICY_VERSION and all(urlparse(url).scheme in ('https', 'http') and urlparse(url).netloc for url in [settings.TERMS_URL, settings.PRIVACY_URL]))


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(never_cache, name='dispatch')
class PublicAuthView(APIView):
    permission_classes = [AllowAny]


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(never_cache, name='dispatch')
class PrivateView(APIView):
    permission_classes = [IsAuthenticated]


class CsrfView(PublicAuthView):
    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class ConfigView(PublicAuthView):
    def get(self, request):
        return Response({'registration_enabled': policies_available(), 'terms_url': settings.TERMS_URL, 'privacy_url': settings.PRIVACY_URL, 'policy_version': settings.POLICY_VERSION, 'development_email': settings.EMAIL_BACKEND != 'django.core.mail.backends.smtp.EmailBackend'})


class MeView(PublicAuthView):
    def get(self, request):
        return Response({'user': UserSerializer(request.user).data if request.user.is_authenticated else None})


class RegisterView(PublicAuthView):
    throttle_classes = [AuthThrottle]
    rate_limit = (20, 3600)

    def post(self, request):
        if not policies_available():
            return Response({'detail': 'Registration is unavailable until published policies are configured.'}, status=503)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            with transaction.atomic():
                user = User.objects.create_user(email=data['email'], password=data['password'], first_name=data['first_name'], last_name=data['last_name'], accepted_policy_at=timezone.now(), accepted_policy_version=data['policy_version'])
        except IntegrityError:
            return Response({'email': ['Unable to register with these details. Try signing in or resetting your password.']}, status=400)
        login(request, user)
        request.session.set_expiry(0)
        return Response({'user': UserSerializer(user).data}, status=201)


class LoginView(PublicAuthView):
    throttle_classes = [AuthThrottle]
    rate_limit = (10, 300)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = authenticate(request, email=data['email'], password=data['password'])
        if not user:
            return Response({'detail': 'The email or password is incorrect.'}, status=400)
        login(request, user)
        request.session.set_expiry(settings.SESSION_COOKIE_AGE if data['remember_me'] else 0)
        return Response({'user': UserSerializer(user).data})


class LogoutView(PublicAuthView):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Signed out.'})


class PasswordResetView(PublicAuthView):
    throttle_classes = [AuthThrottle]
    rate_limit = (5, 900)

    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data['email'], is_active=True).first()
        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f'{settings.FRONTEND_URL}/reset-password/{uid}/{token}'
            try:
                send_mail('Reset your Studio password', f'Reset your password using this one-hour link:\n{reset_url}\n\nIf you did not request this, ignore this message.', settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            except (OSError, SMTPException):
                # Keep response identical for existing and absent accounts; do not log reset secrets.
                logger.error('Password reset delivery failed. Check the configured email service.')
        return Response({'detail': 'If an eligible account exists, a reset link has been requested.', 'development_email': settings.EMAIL_BACKEND != 'django.core.mail.backends.smtp.EmailBackend'})


class PasswordResetConfirmView(PublicAuthView):
    throttle_classes = [AuthThrottle]
    rate_limit = (10, 300)

    def post(self, request):
        serializer = ResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            uid = urlsafe_base64_decode(data['uid']).decode()
            if not uid.isdecimal() or len(uid) > 19:
                raise ValueError
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=uid, is_active=True)
                if not default_token_generator.check_token(user, data['token']):
                    raise ValueError
                serializer = ResetSerializer(data=request.data, context={'user': user})
                serializer.is_valid(raise_exception=True)
                user.set_password(data['password'])
                user.save(update_fields=['password'])
        except (ValueError, UnicodeDecodeError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'This reset link is invalid or has expired.'}, status=400)
        return Response({'detail': 'Password updated. Sign in with your new password.'})


class ProfileView(PrivateView):
    def get(self, request):
        user = request.user
        return Response({
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': getattr(user, 'phone', ''),
            'location': getattr(user, 'location', ''),
            'professional_title': getattr(user, 'professional_title', ''),
            'bio': getattr(user, 'bio', ''),
            'linkedin': getattr(user, 'linkedin', ''),
            'github': getattr(user, 'github', ''),
            'portfolio': getattr(user, 'portfolio', ''),
        })

    def patch(self, request):
        user = request.user
        data = request.data
        user.first_name = data.get('first_name', user.first_name)
        user.last_name = data.get('last_name', user.last_name)
        if hasattr(user, 'phone'):
            user.phone = data.get('phone', user.phone)
        if hasattr(user, 'location'):
            user.location = data.get('location', user.location)
        if hasattr(user, 'professional_title'):
            user.professional_title = data.get('professional_title', user.professional_title)
        if hasattr(user, 'bio'):
            user.bio = data.get('bio', user.bio)
        if hasattr(user, 'linkedin'):
            user.linkedin = data.get('linkedin', user.linkedin)
        if hasattr(user, 'github'):
            user.github = data.get('github', user.github)
        if hasattr(user, 'portfolio'):
            user.portfolio = data.get('portfolio', user.portfolio)
        user.save()
        return Response(self.get(request).data)


class ChangePasswordView(PrivateView):
    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({'detail': 'Current password and new password are required.'}, status=400)
        
        if not user.check_password(current_password):
            return Response({'detail': 'Current password is incorrect.'}, status=400)
        
        if len(new_password) < 8:
            return Response({'detail': 'Password must be at least 8 characters.'}, status=400)
        
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


class PreferencesView(PrivateView):
    def get(self, request):
        from .models import UserPreferences
        prefs, created = UserPreferences.objects.get_or_create(owner=request.user)
        return Response({
            'theme': prefs.theme,
            'cv_page_size': prefs.cv_page_size,
            'region': prefs.region,
            'date_format': prefs.date_format,
            'editor_font_size': prefs.editor_font_size,
            'notifications': prefs.notifications,
        })

    def patch(self, request):
        from .models import UserPreferences
        prefs, created = UserPreferences.objects.get_or_create(owner=request.user)
        data = request.data
        
        if 'theme' in data:
            prefs.theme = data['theme']
        if 'cv_page_size' in data:
            prefs.cv_page_size = data['cv_page_size']
        if 'region' in data:
            prefs.region = data['region']
        if 'date_format' in data:
            prefs.date_format = data['date_format']
        if 'editor_font_size' in data:
            prefs.editor_font_size = data['editor_font_size']
        if 'notifications' in data:
            prefs.notifications = data['notifications']
        
        prefs.save()
        return Response(self.get(request).data)

