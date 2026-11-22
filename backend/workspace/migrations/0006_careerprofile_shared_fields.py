import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0005_cleanup_legacy_document_columns'),
    ]

    operations = [
        migrations.AddField(
            model_name='careerprofile',
            name='personal',
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='careerprofile',
            name='revision',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='careerprofile',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]

