from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0004_remove_templatecreation_owner_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=[
                        'ALTER TABLE workspace_document DROP COLUMN IF EXISTS files;',
                        'DROP TABLE IF EXISTS workspace_documentversion CASCADE;',
                    ],
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.DeleteModel(
                    name='DocumentVersion',
                ),
            ],
        ),
    ]
