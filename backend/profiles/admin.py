from django.contrib import admin
from .models import Profile, Skill, SocialLink


class SkillInline(admin.TabularInline):
    model = Skill
    extra = 1


class SocialLinkInline(admin.TabularInline):
    model = SocialLink
    extra = 1


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "title", "user", "template_id", "slug", "created_at")
    search_fields = ("name", "title", "email", "slug", "user__email", "user__username")
    list_filter = ("template_id", "created_at")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [SkillInline, SocialLinkInline]


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name", "level", "profile", "order")
    search_fields = ("name", "profile__name")


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("platform", "url", "profile", "order")
    search_fields = ("platform", "url", "profile__name")
