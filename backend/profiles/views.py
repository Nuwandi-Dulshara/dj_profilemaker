from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
from django.shortcuts import get_object_or_404
from .models import Profile, Skill
from .serializers import ProfileSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only return profiles owned by current authenticated user
        queryset = Profile.objects.filter(user=self.request.user).prefetch_related("skills", "links")
        search = self.request.query_params.get("search", None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PublicProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        profile = get_object_or_404(
            Profile.objects.prefetch_related("skills", "links"),
            slug=slug
        )
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response({
            "status": "success",
            "profile": serializer.data,
        })


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profiles = Profile.objects.filter(user=user)
        total_profiles = profiles.count()
        total_skills = Skill.objects.filter(profile__user=user).count()

        template_counts = dict(
            profiles.values("template_id").annotate(count=Count("template_id")).values_list("template_id", "count")
        )

        latest = profiles.order_by("-updated_at").first()
        latest_data = None
        if latest:
            latest_data = {
                "id": str(latest.id),
                "name": latest.name,
                "slug": latest.slug,
                "updated_at": latest.updated_at,
            }

        return Response({
            "status": "success",
            "stats": {
                "total_profiles": total_profiles,
                "total_skills": total_skills,
                "template_breakdown": template_counts,
                "latest_profile": latest_data,
            }
        })
