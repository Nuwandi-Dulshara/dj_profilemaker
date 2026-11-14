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
from rest_framework.permissions import AllowAny
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
