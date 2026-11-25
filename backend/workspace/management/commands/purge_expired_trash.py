from django.core.management.base import BaseCommand
from workspace.serializers import TRASH_RETENTION_DAYS
from workspace.services import purge_expired_trash


class Command(BaseCommand):
    help = f'Permanently delete trashed projects older than {TRASH_RETENTION_DAYS} days.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=TRASH_RETENTION_DAYS,
            help=f'Retention period in days (default: {TRASH_RETENTION_DAYS}).',
        )

    def handle(self, *args, **options):
        days = max(1, options['days'])
        purged = purge_expired_trash(days=days)
        self.stdout.write(self.style.SUCCESS(f'Purged {purged} expired trashed project(s) older than {days} days.'))

