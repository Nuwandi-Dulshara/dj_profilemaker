from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.throttling import BaseThrottle
from .models import AuthRateBucket


class AuthThrottle(BaseThrottle):
    """Database-shared, atomic fixed-window limits; never trust client-supplied forwarding headers."""
    def allow_request(self, request, view):
        limit, seconds = view.rate_limit
        key = salted_hmac('auth-rate', f'{view.__class__.__name__}:{request.META.get("REMOTE_ADDR", "unknown")}').hexdigest()
        now = timezone.now()
        with transaction.atomic():
            bucket, _ = AuthRateBucket.objects.get_or_create(key=key, defaults={'expires_at': now + timedelta(seconds=seconds)})
            bucket = AuthRateBucket.objects.select_for_update().get(pk=bucket.pk)
            if bucket.expires_at <= now:
                bucket.count = 0
                bucket.expires_at = now + timedelta(seconds=seconds)
            self.retry_after = max(1, (bucket.expires_at - now).total_seconds())
            if bucket.count >= limit:
                return False
            bucket.count += 1
            bucket.save(update_fields=['count', 'expires_at'])
        return True

    def wait(self):
        return self.retry_after
