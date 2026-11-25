from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Project, Document, Folder, Activity, Notification, CareerProfile


@override_settings(SECURE_SSL_REDIRECT=False)
class DashboardTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('owner@example.test', 'Phrase-Safe!123', first_name='Alex', last_name='Morgan')
        self.other = get_user_model().objects.create_user('other@example.test', 'Phrase-Safe!123')
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)
        self.project = Project.objects.create(owner=self.user, title='Engineering CV', kind='advanced_cv')
        Document.objects.create(project=self.project, content={'name': 'Alex'}, design={'size': 'A4'})
        self.foreign = Project.objects.create(owner=self.other, title='Private', kind='cover_letter')

    def mutate(self, path, data=None, method='post'):
        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        return getattr(self.client, method)(path, data or {}, format='json', HTTP_X_CSRFTOKEN=token)

    def action(self, action, project=None):
        return self.mutate(f'/api/projects/{(project or self.project).pk}/{action}/')

    def test_requires_authentication_and_csrf(self):
        self.assertEqual(self.client.patch(f'/api/projects/{self.project.pk}/', {'title': 'Blocked'}, format='json').status_code, 403)
        self.client.logout()
        for path in ['summary', 'recent-projects', 'activity', 'storage']:
            self.assertEqual(self.client.get(f'/api/dashboard/{path}/').status_code, 403)
        self.assertEqual(self.client.get('/api/notifications/').status_code, 403)

    def test_counts_are_owned_and_exclude_deleted_but_include_archived(self):
        Project.objects.create(owner=self.user, title='Archived', kind='cover_letter', archived=True)
        Project.objects.create(owner=self.user, title='Deleted', kind='advanced_cv', deleted_at=timezone.now())
        data = self.client.get('/api/dashboard/summary/').json()
        self.assertEqual(data['counts'], {'total': 2, 'advanced_cv': 1, 'cover_letter': 1, 'deleted': 1})
        self.assertEqual(data['workflows'], {'advanced_cv': True, 'cover_letter': True, 'profile': True})

    def test_search_pagination_and_state_filters(self):
        for i in range(8):
            Project.objects.create(owner=self.user, title=f'Design {i}', kind='advanced_cv')
        response = self.client.get('/api/dashboard/recent-projects/?search=Design&page_size=3&page=2').json()
        self.assertEqual(response['count'], 8)
        self.assertEqual(len(response['results']), 3)
        self.action('delete')
        deleted = self.client.get('/api/dashboard/recent-projects/?state=deleted').json()
        self.assertEqual([p['title'] for p in deleted['results']], ['Engineering CV'])
        self.assertEqual(self.client.get('/api/dashboard/recent-projects/?state=invalid').status_code, 400)

    def test_cross_user_actions_and_folders_are_rejected(self):
        for action in ['duplicate', 'delete', 'restore']:
            self.assertEqual(self.action(action, self.foreign).status_code, 404)
        self.assertEqual(self.mutate(f'/api/projects/{self.foreign.pk}/', {'title': 'Stolen'}, 'patch').status_code, 404)
        folder = Folder.objects.create(owner=self.other, name='Private folder')
        self.assertEqual(self.mutate(f'/api/projects/{self.project.pk}/', {'folder': str(folder.pk)}, 'patch').status_code, 400)
        self.assertEqual(self.client.get('/api/folders/').json(), [])

    def test_rename_favorite_move_and_archive_record_activity(self):
        folder = self.mutate('/api/folders/', {'name': 'Applications'}).json()
        response = self.mutate(f'/api/projects/{self.project.pk}/', {'title': 'Updated', 'favorite': True, 'folder': folder['id'], 'archived': True}, 'patch')
        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, 'Updated')
        self.assertTrue(self.project.favorite)
        self.assertEqual(str(self.project.folder_id), folder['id'])
        self.assertEqual(self.client.get('/api/dashboard/recent-projects/').json()['count'], 0)
        self.assertEqual(self.client.get('/api/dashboard/recent-projects/?state=archived').json()['count'], 1)
        self.assertTrue(Activity.objects.filter(owner=self.user, project=self.project).exists())
        self.assertEqual(self.mutate(f'/api/projects/{self.project.pk}/', {'title': ' '}, 'patch').status_code, 400)

    def test_duplicate_has_independent_document_and_preserves_original(self):
        response = self.action('duplicate')
        self.assertEqual(response.status_code, 201)
        clone = Project.objects.get(pk=response.json()['id'])
        self.assertEqual(clone.owner, self.user)
        self.assertEqual(clone.document.content, self.project.document.content)
        clone.document.content = {'name': 'Changed'}
        clone.document.save()
        self.project.document.refresh_from_db()
        self.assertEqual(self.project.document.content, {'name': 'Alex'})

    def test_delete_is_recoverable_and_deleted_projects_cannot_be_edited(self):
        self.assertEqual(self.action('delete').status_code, 200)
        self.assertTrue(Document.objects.filter(project=self.project).exists())
        self.assertEqual(self.mutate(f'/api/projects/{self.project.pk}/', {'title': 'Changed'}, 'patch').status_code, 404)
        self.assertEqual(self.action('duplicate').status_code, 404)
        self.assertEqual(self.action('restore').status_code, 200)
        self.project.refresh_from_db()
        self.assertIsNone(self.project.deleted_at)

    def test_profile_completion_uses_seven_actual_sections(self):
        profile = self.client.get('/api/dashboard/summary/').json()['profile']
        self.assertEqual(profile['completed'], 1)
        self.assertEqual(profile['total'], 7)
        CareerProfile.objects.create(owner=self.user, summary='Engineer', experience=[{'title': 'Developer'}], skills=['Python'])
        profile = self.client.get('/api/dashboard/summary/').json()['profile']
        self.assertEqual(profile['completed'], 4)
        self.assertEqual(profile['percent'], 57)

    def test_notification_read_updates_are_scoped_and_idempotent(self):
        mine = Notification.objects.create(owner=self.user, kind='important', title='Account notice', message='A real event')
        theirs = Notification.objects.create(owner=self.other, kind='comment', title='Private', message='Private')
        self.assertEqual(self.client.get('/api/notifications/').json()['unread_count'], 1)
        self.assertEqual(self.mutate(f'/api/notifications/{theirs.pk}/', {'is_read': True}, 'patch').status_code, 404)
        for _ in range(2):
            self.assertEqual(self.mutate(f'/api/notifications/{mine.pk}/', {'is_read': True}, 'patch').status_code, 200)
        self.assertEqual(self.client.get('/api/notifications/').json()['unread_count'], 0)
        self.mutate('/api/notifications/read-all/')
        theirs.refresh_from_db()
        self.assertFalse(theirs.is_read)

    def test_storage_counts_only_owned_stored_documents_including_deleted(self):
        before = self.client.get('/api/dashboard/storage/').json()
        self.assertGreater(before['used_bytes'], 0)
        self.assertIsNone(before['quota_bytes'])
        Document.objects.create(project=self.foreign, content={'text': 'x' * 10000})
        self.action('delete')
        self.assertEqual(self.client.get('/api/dashboard/storage/').json(), before)

    def test_activity_is_owner_scoped(self):
        Activity.objects.create(owner=self.other, title='Private event', action='updated')
        self.action('duplicate')
        results = self.client.get('/api/dashboard/activity/').json()['results']
        self.assertEqual(len(results), 1)
        self.assertNotEqual(results[0]['title'], 'Private event')

    def test_projects_endpoint_filters_sorting_and_create_delete(self):
        folder = Folder.objects.create(owner=self.user, name='Tech Roles')
        created = self.mutate('/api/projects/', {'title': 'Alpha Letter', 'kind': 'cover_letter', 'folder': str(folder.pk), 'favorite': True})
        self.assertEqual(created.status_code, 201)
        alpha_id = created.json()['id']
        self.assertTrue(Document.objects.filter(project_id=alpha_id).exists())

        by_title = self.client.get('/api/projects/?ordering=title').json()['results']
        self.assertEqual([p['title'] for p in by_title], ['Alpha Letter', 'Engineering CV'])
        by_title_desc = self.client.get('/api/projects/?ordering=-title').json()['results']
        self.assertEqual([p['title'] for p in by_title_desc], ['Engineering CV', 'Alpha Letter'])

        filtered = self.client.get(f'/api/projects/?kind=cover_letter&favorite=true&folder={folder.pk}').json()
        self.assertEqual(filtered['count'], 1)
        self.assertEqual(filtered['results'][0]['id'], alpha_id)
        self.assertEqual(filtered['stats']['favorites'], 1)

        unfiled = self.client.get('/api/projects/?folder=none').json()
        self.assertEqual([p['title'] for p in unfiled['results']], ['Engineering CV'])

        detail = self.client.get(f'/api/projects/{alpha_id}/')
        self.assertEqual(detail.status_code, 200)
        deleted = self.mutate(f'/api/projects/{alpha_id}/', method='delete')
        self.assertEqual(deleted.status_code, 200)
        self.assertIsNotNone(deleted.json()['deleted_at'])

    def test_folder_hierarchy_rename_move_and_cycle_prevention(self):
        root = self.mutate('/api/project-folders/', {'name': 'Career 2026'}).json()
        child = self.mutate('/api/project-folders/', {'name': 'Engineering', 'parent': root['id']}).json()
        self.assertEqual(child['parent'], root['id'])
        self.assertEqual(child['parent_name'], 'Career 2026')

        self.assertEqual(self.mutate(f"/api/project-folders/{root['id']}/", {'parent': root['id']}, 'patch').status_code, 400)
        self.assertEqual(self.mutate(f"/api/project-folders/{root['id']}/", {'parent': child['id']}, 'patch').status_code, 400)

        foreign_folder = Folder.objects.create(owner=self.other, name='Other Root')
        self.assertEqual(self.mutate(f"/api/project-folders/{child['id']}/", {'parent': str(foreign_folder.pk)}, 'patch').status_code, 400)

        renamed = self.mutate(f"/api/project-folders/{child['id']}/", {'name': 'Platform Engineering'}, 'patch')
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json()['name'], 'Platform Engineering')

        self.project.folder_id = child['id']
        self.project.save(update_fields=['folder'])
        deleted = self.mutate(f"/api/project-folders/{child['id']}/", method='delete')
        self.assertEqual(deleted.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(str(self.project.folder_id), root['id'])

    def test_bulk_actions_enforce_ownership_and_update_state(self):
        second = Project.objects.create(owner=self.user, title='Product CV', kind='advanced_cv')
        folder = Folder.objects.create(owner=self.user, name='Target Folder')
        ids = [str(self.project.pk), str(second.pk), str(self.foreign.pk)]

        fav_res = self.mutate('/api/projects/bulk-actions/', {'action': 'favorite', 'project_ids': ids})
        self.assertEqual(fav_res.status_code, 200)
        self.assertEqual(fav_res.json()['updated_count'], 2)
        self.assertEqual(fav_res.json()['failed_ids'], [str(self.foreign.pk)])

        move_res = self.mutate('/api/projects/bulk-actions/', {'action': 'move', 'project_ids': [str(self.project.pk), str(second.pk)], 'folder': str(folder.pk)})
        self.assertEqual(move_res.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.folder_id, folder.pk)

        arch_res = self.mutate('/api/projects/bulk-actions/', {'action': 'archive', 'project_ids': [str(self.project.pk), str(second.pk)]})
        self.assertEqual(arch_res.status_code, 200)
        self.project.refresh_from_db()
        self.assertTrue(self.project.archived)

        del_res = self.mutate('/api/projects/bulk-actions/', {'action': 'delete', 'project_ids': [str(self.project.pk), str(second.pk)]})
        self.assertEqual(del_res.status_code, 200)
        self.project.refresh_from_db()
        self.assertIsNotNone(self.project.deleted_at)

        rest_res = self.mutate('/api/projects/bulk-actions/', {'action': 'restore', 'project_ids': [str(self.project.pk), str(second.pk)]})
        self.assertEqual(rest_res.status_code, 200)
        self.project.refresh_from_db()
        self.assertIsNone(self.project.deleted_at)

        self.foreign.refresh_from_db()
        self.assertFalse(self.foreign.favorite)
        self.assertIsNone(self.foreign.deleted_at)

    def test_duplicate_with_custom_title_and_zip_upload_extraction(self):
        import io
        import zipfile
        from django.core.files.uploadedfile import SimpleUploadedFile

        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        dup = self.client.post(
            f'/api/projects/{self.project.pk}/duplicate/',
            {'title': 'Engineering CV Copy 2026'},
            format='json',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(dup.status_code, 201)
        self.assertEqual(dup.json()['title'], 'Engineering CV Copy 2026')

        bad_buf = io.BytesIO()
        with zipfile.ZipFile(bad_buf, 'w') as zf:
            zf.writestr('../evil.jsx', 'rejected path traversal')
        bad_buf.seek(0)
        bad_res = self.client.post(
            f'/api/projects/{self.project.pk}/upload-zip/',
            {'file': SimpleUploadedFile('evil.zip', bad_buf.read(), content_type='application/zip')},
            format='multipart',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(bad_res.status_code, 400)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as zf:
            zf.writestr('components/Header.jsx', 'export default function Header() { return <header>CV</header>; }')
            zf.writestr('styles.css', '.cv { color: navy; }')
        buf.seek(0)

        upload = SimpleUploadedFile('cv-bundle.zip', buf.read(), content_type='application/zip')
        res = self.client.post(
            f'/api/projects/{self.project.pk}/upload-zip/',
            {'file': upload},
            format='multipart',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('components/Header.jsx', data['content']['files'])
        self.assertIn('styles.css', data['content']['files'])
        self.assertIn('components', data['content']['folders'])

    def test_career_profile_requires_login_and_returns_empty_defaults(self):
        self.client.logout()
        self.assertEqual(self.client.get('/api/career-profile/').status_code, 403)
        self.client.force_login(self.user)
        data = self.client.get('/api/career-profile/').json()
        self.assertEqual(data['revision'], 0)
        self.assertEqual(data['personal']['first_name'], 'Alex')
        self.assertEqual(data['personal']['email'], 'owner@example.test')
        self.assertEqual(data['experience'], [])
        self.assertEqual(data['skills'], [])

    def test_career_profile_update_cleans_data_and_bumps_revision_only_on_change(self):
        payload = {
            'personal': {'phone': ' +1 555 0100 ', 'location': 'Colombo', 'first_name': 'Alexandra'},
            'summary': ' Backend engineer. ',
            'skills': 'Python, Django\nPython, React',
            'experience': [
                {'company': 'Acme', 'role': 'Engineer', 'description': 'Built APIs', 'current': True, 'unexpected': 'dropped'},
                {'company': '', 'role': ''},
            ],
            'education': [{'institution': 'University', 'degree': 'BSc'}],
        }
        first = self.mutate('/api/career-profile/', payload, 'put')
        self.assertEqual(first.status_code, 200)
        body = first.json()
        self.assertEqual(body['revision'], 2)
        self.assertEqual(body['personal']['phone'], '+1 555 0100')
        self.assertEqual(body['personal']['first_name'], 'Alexandra')
        self.assertEqual(body['summary'], 'Backend engineer.')
        self.assertEqual(body['skills'], ['Python', 'Django', 'React'])
        self.assertEqual(len(body['experience']), 1)
        self.assertNotIn('unexpected', body['experience'][0])
        self.assertTrue(body['experience'][0]['current'])
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Alexandra')

        same = self.mutate('/api/career-profile/', payload, 'put').json()
        self.assertEqual(same['revision'], 2)

        edited = self.mutate('/api/career-profile/', {'summary': 'Updated summary'}, 'put').json()
        self.assertEqual(edited['revision'], 3)
        self.assertEqual(edited['skills'], ['Python', 'Django', 'React'])

    def test_career_profile_validation_and_csrf(self):
        self.assertEqual(self.client.put('/api/career-profile/', {'summary': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.mutate('/api/career-profile/', {'experience': 'nope'}, 'put').status_code, 400)
        self.assertEqual(self.mutate('/api/career-profile/', {'experience': ['nope']}, 'put').status_code, 400)
        self.assertEqual(self.mutate('/api/career-profile/', {'personal': {'first_name': ' '}}, 'put').status_code, 400)
        self.assertEqual(self.mutate('/api/career-profile/', {'skills': {'a': 1}}, 'put').status_code, 400)

    def test_career_profile_is_private_to_each_user(self):
        self.mutate('/api/career-profile/', {'summary': 'Private summary'}, 'put')
        other = APIClient()
        other.force_login(self.other)
        data = other.get('/api/career-profile/').json()
        self.assertEqual(data['summary'], '')
        self.assertEqual(data['revision'], 0)

    def test_thirty_day_automatic_trash_deletion(self):
        from datetime import timedelta
        from django.core.management import call_command
        from django.utils import timezone

        recent_trashed = Project.objects.create(
            owner=self.user,
            title='Recent Trashed CV',
            kind='advanced_cv',
            deleted_at=timezone.now() - timedelta(days=10),
        )
        expired_trashed = Project.objects.create(
            owner=self.user,
            title='Expired Trashed CV',
            kind='advanced_cv',
            deleted_at=timezone.now() - timedelta(days=31),
        )
        other_expired = Project.objects.create(
            owner=self.other,
            title='Other User Expired CV',
            kind='advanced_cv',
            deleted_at=timezone.now() - timedelta(days=35),
        )

        # Listing trashed projects for self.user purges only self.user's expired items
        res = self.client.get('/api/projects/?state=deleted')
        self.assertEqual(res.status_code, 200)
        titles = [item['title'] for item in res.json()['results']]
        self.assertIn('Recent Trashed CV', titles)
        self.assertNotIn('Expired Trashed CV', titles)
        self.assertEqual(res.json()['results'][0]['trash_days_remaining'], 20)
        self.assertFalse(Project.objects.filter(id=expired_trashed.id).exists())
        self.assertTrue(Project.objects.filter(id=recent_trashed.id).exists())
        self.assertTrue(Project.objects.filter(id=other_expired.id).exists())

        # Management command purges remaining expired items across all users
        call_command('purge_expired_trash')
        self.assertFalse(Project.objects.filter(id=other_expired.id).exists())

    def test_job_specific_cv_versions_and_comparison_endpoint(self):
        base = self.mutate('/api/projects/', {
            'title': 'Master CV',
            'kind': 'advanced_cv',
            'content': {'files': {'App.jsx': 'export default function CV() { return <h1>Base</h1>; }'}},
        }).json()

        bad = self.mutate(f"/api/projects/{base['id']}/create-variant/", {'target_role': '   '})
        self.assertEqual(bad.status_code, 400)

        v1 = self.mutate(f"/api/projects/{base['id']}/create-variant/", {
            'target_role': 'Stripe — Backend Engineer',
        }).json()
        self.assertEqual(v1['parent_project'], base['id'])
        self.assertEqual(v1['target_role'], 'Stripe — Backend Engineer')
        self.assertIn('Stripe — Backend Engineer', v1['title'])

        # Creating a variant from a variant still groups under the base CV
        v2 = self.mutate(f"/api/projects/{v1['id']}/create-variant/", {
            'target_role': 'Vercel — Frontend Engineer',
            'title': 'Vercel CV',
        }).json()
        self.assertEqual(v2['parent_project'], base['id'])
        self.assertEqual(v2['title'], 'Vercel CV')

        versions = self.client.get(f"/api/projects/{v1['id']}/versions/")
        self.assertEqual(versions.status_code, 200)
        body = versions.json()
        self.assertEqual(body['base_id'], base['id'])
        self.assertEqual(body['current_id'], v1['id'])
        self.assertEqual(len(body['versions']), 3)
        self.assertEqual(body['versions'][0]['is_base'], True)
        self.assertEqual(body['versions'][1]['is_current'], True)
        self.assertIn('App.jsx', body['versions'][1]['files'])

    def test_version_history_snapshots_and_restore(self):
        proj = self.mutate('/api/projects/', {'title': 'Versioned CV', 'kind': 'advanced_cv'}).json()
        v2 = self.mutate(f"/api/projects/{proj['id']}/document/", {
            'title': 'Versioned CV v2',
            'content': {'files': {'App.jsx': '<h1>V2</h1>'}},
        }, 'put')
        self.assertEqual(v2.status_code, 200)

        v3 = self.mutate(f"/api/projects/{proj['id']}/document/", {
            'title': 'Versioned CV v3',
            'content': {'files': {'App.jsx': '<h1>V3</h1>'}},
        }, 'put')
        self.assertEqual(v3.status_code, 200)

        snaps = self.client.get(f"/api/projects/{proj['id']}/snapshots/").json()['snapshots']
        self.assertEqual(len(snaps), 2)
        self.assertEqual(snaps[0]['title'], 'Versioned CV v3')
        self.assertEqual(snaps[1]['title'], 'Versioned CV v2')

        restored = self.mutate(f"/api/projects/{proj['id']}/snapshots/{snaps[1]['id']}/restore/", {})
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['project']['title'], 'Versioned CV v2')
        self.assertEqual(restored.json()['content']['files']['App.jsx'], '<h1>V2</h1>')

    def test_public_share_link_and_export_history(self):
        proj = self.mutate('/api/projects/', {
            'title': 'Shareable CV',
            'kind': 'advanced_cv',
            'content': {'files': {'App.jsx': '<h1>Public Resume</h1>'}},
        }).json()

        created = self.mutate(f"/api/projects/{proj['id']}/share/", {})
        self.assertEqual(created.status_code, 201)
        token = created.json()['share']['token']

        anon = APIClient()
        pub = anon.get(f'/api/public/share/{token}/')
        self.assertEqual(pub.status_code, 200)
        self.assertEqual(pub.json()['title'], 'Shareable CV')
        self.assertIn('App.jsx', pub.json()['content']['files'])

        revoked = self.mutate(f"/api/projects/{proj['id']}/share/", {}, 'delete')
        self.assertEqual(revoked.status_code, 200)
        self.assertEqual(anon.get(f'/api/public/share/{token}/').status_code, 404)

        e1 = self.mutate(f"/api/projects/{proj['id']}/exports/", {'format': 'pdf'})
        e2 = self.mutate(f"/api/projects/{proj['id']}/exports/", {'format': 'docx'})
        self.assertEqual(e1.status_code, 201)
        self.assertEqual(e2.status_code, 201)
        summary = self.client.get(f"/api/projects/{proj['id']}/exports/").json()
        self.assertEqual(summary['pdf_count'], 1)
        self.assertEqual(summary['docx_count'], 1)
        self.assertEqual(summary['total_count'], 2)

