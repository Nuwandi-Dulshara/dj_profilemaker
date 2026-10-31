from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from profiles.models import Profile, Skill, SocialLink


class Command(BaseCommand):
    help = "Seeds initial demo user and demo profile"

    def handle(self, *args, **options):
        # Create demo user if not exists
        demo_email = "alex@example.com"
        user, created = User.objects.get_or_create(
            username=demo_email,
            email=demo_email,
            defaults={
                "first_name": "Alex Morgan",
                "is_staff": True,
                "is_superuser": True,
            }
        )
        if created:
            user.set_password("password123")
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created demo user: {demo_email} (password: password123)"))
        else:
            self.stdout.write(f"User {demo_email} already exists.")

        token, _ = Token.objects.get_or_create(user=user)
        self.stdout.write(f"Demo token: {token.key}")

        # Create demo profile
        if not Profile.objects.filter(slug="alex-morgan").exists():
            profile = Profile.objects.create(
                user=user,
                name="Alex Morgan",
                title="Full Stack Developer",
                bio="I build thoughtful digital experiences using modern web technologies.",
                email="alex@example.com",
                phone="+94 77 123 4567",
                location="Colombo, Sri Lanka",
                template_id="professional",
                slug="alex-morgan",
            )

            Skill.objects.bulk_create([
                Skill(profile=profile, name="React", level=90, order=0),
                Skill(profile=profile, name="Python", level=85, order=1),
                Skill(profile=profile, name="Django", level=80, order=2),
            ])

            SocialLink.objects.bulk_create([
                SocialLink(profile=profile, platform="GitHub", url="https://github.com/", order=0),
                SocialLink(profile=profile, platform="LinkedIn", url="https://linkedin.com/", order=1),
            ])

            self.stdout.write(self.style.SUCCESS("Created demo profile 'Alex Morgan' (slug: alex-morgan)"))
        else:
            self.stdout.write("Demo profile 'alex-morgan' already exists.")
