"""Private Drive originals, separate from editable JSON CVs."""
from .cloud import Drive, file_id
from .errors import CvError
from urllib.parse import urlencode


class AssetDrive(Drive):
    def upload_asset(self, name, data, mime):
        query = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='profile-studio-originals' } and appProperties has { key='owner' and value='" + self.owner + "' }"
        folders = self.request('GET', self.base + '?' + urlencode({'q': query, 'fields': 'files(id,appProperties)', 'pageSize': 1}))
        folder = next((f['id'] for f in folders.get('files', []) if f.get('appProperties', {}).get('owner') == self.owner and f.get('appProperties', {}).get('app') == 'profile-studio-originals'), None)
        if not folder:
            import json
            result = self.request('POST', self.base + '?fields=id', data=json.dumps({
                'name': 'Profile Studio CV Originals', 'mimeType': 'application/vnd.google-apps.folder',
                'appProperties': {'owner': self.owner, 'app': 'profile-studio-originals'}}).encode(), headers={'Content-Type': 'application/json'})
            folder = result.get('id')
        if not folder:
            raise CvError('Drive did not confirm the originals folder.', 502)
        result = self.upload_file({'name': name, 'mimeType': mime, 'parents': [folder],
                                  'appProperties': {'app': 'profile-studio-asset', 'owner': self.owner}}, data, mime)
        if not result.get('id'):
            raise CvError('Drive did not confirm the original upload.', 502)
        return result['id']

    def metadata(self, ident):
        meta, headers = self.request('GET', self.base + '/' + file_id(ident) + '?fields=id,mimeType,appProperties,trashed', with_headers=True)
        props = meta.get('appProperties', {})
        if meta.get('trashed') or props.get('app') != 'profile-studio-asset' or props.get('owner') != self.owner:
            raise CvError('Original file not found in your connected Drive.', 404)
        if headers.get('ETag'):
            self.etags[ident] = headers['ETag']
        return meta

    def content(self, ident):
        self.metadata(ident)
        return self.request('GET', self.base + '/' + file_id(ident) + '?alt=media', raw=True)
