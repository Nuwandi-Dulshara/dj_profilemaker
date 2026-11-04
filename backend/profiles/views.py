import io
import qrcode
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from .models import (
    Profile,
    Skill,
    Experience,
    Education,
    Project,
    ProfileView,
    ContactMessage,
)
from .serializers import ProfileSerializer, ContactMessageSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.action in ["qr", "pdf"] or not self.request.user.is_authenticated:
            return Profile.objects.all().prefetch_related(
                "skills", "links", "experiences", "education", "projects"
            )
        queryset = (
            Profile.objects.filter(user=self.request.user)
            .prefetch_related("skills", "links", "experiences", "education", "projects")
        )
        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def qr(self, request, pk=None):
        """Generate dynamic QR code PNG for this profile."""
        profile = self.get_object()
        url = request.build_absolute_uri(f"/p/{profile.slug}")
        img = qrcode.make(url)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return HttpResponse(buffer.getvalue(), content_type="image/png")

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def pdf(self, request, pk=None):
        """Generate PDF resume for this profile."""
        profile = self.get_object()
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Header bar
        p.setFillColor(colors.HexColor("#1e3a8a"))
        p.rect(0, height - 100, width, 100, fill=1, stroke=0)

        # Name and Title
        p.setFillColor(colors.white)
        p.setFont("Helvetica-Bold", 24)
        p.drawString(40, height - 50, profile.name)

        p.setFont("Helvetica", 14)
        p.drawString(40, height - 75, profile.title or "Professional Profile")

        # Contact Info
        p.setFillColor(colors.HexColor("#1e293b"))
        p.setFont("Helvetica-Bold", 12)
        y = height - 130
        p.drawString(40, y, "Contact Details")
        p.setStrokeColor(colors.HexColor("#cbd5e1"))
        p.line(40, y - 4, width - 40, y - 4)

        p.setFont("Helvetica", 10)
        y -= 22
        contact_line = f"Email: {profile.email}   |   Phone: {profile.phone}   |   Location: {profile.location}"
        p.drawString(40, y, contact_line)

        # About Me
        y -= 30
        p.setFont("Helvetica-Bold", 12)
        p.drawString(40, y, "About Me")
        p.line(40, y - 4, width - 40, y - 4)
        p.setFont("Helvetica", 10)
        y -= 18
        bio_lines = (profile.bio or "No bio provided.").split("\n")
        for line in bio_lines[:4]:
            p.drawString(40, y, line[:95])
            y -= 14

        # Experience
        if profile.experiences.exists():
            y -= 16
            p.setFont("Helvetica-Bold", 12)
            p.drawString(40, y, "Work Experience")
            p.line(40, y - 4, width - 40, y - 4)
            for exp in profile.experiences.all()[:4]:
                y -= 18
                p.setFont("Helvetica-Bold", 10)
                p.drawString(40, y, f"{exp.role} - {exp.company} ({exp.start_date})")
                if exp.description:
                    y -= 14
                    p.setFont("Helvetica", 9)
                    p.drawString(40, y, exp.description[:95])

        # Skills
        if profile.skills.exists():
            y -= 20
            p.setFont("Helvetica-Bold", 12)
            p.drawString(40, y, "Skills")
            p.line(40, y - 4, width - 40, y - 4)
            y -= 16
            p.setFont("Helvetica", 10)
            skills_str = ", ".join([f"{s.name} ({s.level}%)" for s in profile.skills.all()[:10]])
            p.drawString(40, y, skills_str[:95])

        p.showPage()
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{profile.slug}-resume.pdf"'
        return response


class PublicProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        profile = get_object_or_404(
            Profile.objects.prefetch_related(
                "skills", "links", "experiences", "education", "projects"
            ),
            slug=slug,
        )

        # Increment view count
        Profile.objects.filter(pk=profile.pk).update(views_count=profile.views_count + 1)
        profile.views_count += 1

        # Track view analytics
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")[:255]
        ProfileView.objects.create(profile=profile, ip_address=ip, user_agent=ua)

        serializer = ProfileSerializer(profile, context={"request": request})
        return Response({
            "status": "success",
            "profile": serializer.data,
        })


class ContactMessageCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        profile = get_object_or_404(Profile, slug=slug)
        serializer = ContactMessageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(profile=profile)
            return Response(
                {
                    "status": "success",
                    "message": f"Your message has been sent to {profile.name}.",
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"status": "error", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profiles = Profile.objects.filter(user=user)
        total_profiles = profiles.count()
        total_skills = Skill.objects.filter(profile__user=user).count()
        total_experiences = Experience.objects.filter(profile__user=user).count()
        total_projects = Project.objects.filter(profile__user=user).count()
        total_views = profiles.aggregate(Sum("views_count"))["views_count__sum"] or 0

        template_counts = dict(
            profiles.values("template_id")
            .annotate(count=Count("template_id"))
            .values_list("template_id", "count")
        )

        latest = profiles.order_by("-updated_at").first()
        latest_data = None
        if latest:
            latest_data = {
                "id": str(latest.id),
                "name": latest.name,
                "slug": latest.slug,
                "views_count": latest.views_count,
                "updated_at": latest.updated_at,
            }

        return Response({
            "status": "success",
            "stats": {
                "total_profiles": total_profiles,
                "total_skills": total_skills,
                "total_experiences": total_experiences,
                "total_projects": total_projects,
                "total_views": total_views,
                "template_breakdown": template_counts,
                "latest_profile": latest_data,
            },
        })
