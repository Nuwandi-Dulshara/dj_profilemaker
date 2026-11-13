from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer
from django.contrib.auth import login as session_login, logout as session_logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        response = Response({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(csrf_protect, name="dispatch")
class BrowserLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        if self.serializer_class is RegisterSerializer:
            user, _ = serializer.save()
        else:
            user = serializer.validated_data["user"]
        session_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        response = Response({"status": "success", "user": UserSerializer(user).data})
        response["Cache-Control"] = "no-store"
        return response


class BrowserRegisterView(BrowserLoginView):
    serializer_class = RegisterSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user, token = serializer.save()
            return Response(
                {
                    "status": "success",
                    "message": "Account created successfully.",
                    "token": token.key,
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {
                "status": "error",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            token = serializer.validated_data["token"]
            return Response(
                {
                    "status": "success",
                    "message": "Logged in successfully.",
                    "token": token.key,
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                "status": "error",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        session_logout(request)
        return Response(
            {
                "status": "success",
                "message": "Logged out successfully.",
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(
            {
                "status": "success",
                "user": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class SettingsUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        name = request.data.get("name")
        email = request.data.get("email")
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if name:
            user.first_name = name
        if email:
            if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                return Response(
                    {"status": "error", "message": "Email address is already in use by another account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email = email
            user.username = email

        if new_password:
            if not current_password or not check_password(current_password, user.password):
                return Response(
                    {"status": "error", "message": "Current password does not match."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(new_password) < 8:
                return Response(
                    {"status": "error", "message": "New password must be at least 8 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(new_password)

        user.save()
        if new_password:
            update_session_auth_hash(request, user)
        return Response({
            "status": "success",
            "message": "Account settings updated successfully.",
            "user": UserSerializer(user).data,
        })


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        if not email:
            return Response(
                {"status": "error", "message": "Please provide an email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.filter(email=email).first()
        if user:
            send_mail(
                subject="Reset Your Profile Studio Pro Password",
                message=f"Hello {user.first_name or user.username},\n\nPlease follow this link to reset your password:\nhttp://localhost:5173/reset-password",
                from_email="noreply@profilestudio.local",
                recipient_list=[email],
                fail_silently=True,
            )
        # Return success regardless for security / email enumeration prevention
        return Response({
            "status": "success",
            "message": "If an account exists with this email, a reset link has been dispatched.",
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        new_password = request.data.get("password")
        if not new_password or len(new_password) < 8:
            return Response(
                {"status": "error", "message": "Password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if email:
            user = User.objects.filter(email=email).first()
            if user:
                user.set_password(new_password)
                user.save()
        return Response({
            "status": "success",
            "message": "Password has been successfully updated. You may now log in.",
        })


class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        send_mail(
            subject="Verify your Profile Studio Pro Account",
            message=f"Hello {user.first_name},\n\nPlease verify your email by clicking the confirmation link.",
            from_email="noreply@profilestudio.local",
            recipient_list=[user.email],
            fail_silently=True,
        )
        return Response({
            "status": "success",
            "message": f"Verification email dispatched to {user.email}.",
        })
