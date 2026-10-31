import urllib.request
import urllib.parse
import json

BASE_URL = 'http://127.0.0.1:8000'

def request(path, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Token {token}'
    req_data = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(f'{BASE_URL}{path}', data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode('utf-8')
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        return e.code, json.loads(body) if body else {}

print('--- Step 1: Testing User Registration ---')
status, res = request('/api/auth/register/', 'POST', {
    'name': 'Integration Tester',
    'email': 'e2e_tester@example.com',
    'password': 'Password1234!'
})
print(f'Registration status: {status}, response: {res.get("status")}')
assert status in (201, 400), f'Unexpected status: {status}'

print('\n--- Step 2: Testing User Login ---')
status, res = request('/api/auth/login/', 'POST', {
    'email': 'alex@example.com',
    'password': 'password123'
})
print(f'Login status: {status}, token obtained: {bool(res.get("token"))}')
assert status == 200 and 'token' in res, 'Login failed!'
token = res['token']

print('\n--- Step 3: Testing /api/auth/me/ ---')
status, res = request('/api/auth/me/', 'GET', token=token)
user_data = res.get('user', {})
print(f'Me status: {status}, User: {user_data.get("name")} ({user_data.get("email")})')
assert status == 200

print('\n--- Step 4: Testing GET /api/profiles/ (Dashboard List) ---')
status, profiles = request('/api/profiles/', 'GET', token=token)
print(f'Profiles count: {len(profiles)}')
for p in profiles:
    print(f' - Profile: {p["name"]}, Title: {p.get("title")}, Slug: {p["slug"]}')
assert status == 200

print('\n--- Step 5: Testing POST /api/profiles/ (Create Profile in MySQL) ---')
status, new_prof = request('/api/profiles/', 'POST', {
    'name': 'Sophia Chen',
    'title': 'AI Research Engineer',
    'bio': 'Pioneering machine learning architectures.',
    'email': 'sophia@example.com',
    'phone': '+65 9123 4567',
    'location': 'Singapore',
    'template_id': 'modern',
    'skills': [
        {'name': 'PyTorch', 'level': 95},
        {'name': 'LLM Fine-tuning', 'level': 90}
    ],
    'links': [
        {'platform': 'GitHub', 'url': 'https://github.com/sophiachen'}
    ]
}, token=token)
print(f'Create status: {status}, ID: {new_prof.get("id")}, Slug: {new_prof.get("slug")}')
assert status == 201
new_id = new_prof['id']
slug = new_prof['slug']

print('\n--- Step 6: Testing GET /api/public/p/<slug>/ (Public Access without Auth) ---')
status, pub_prof = request(f'/api/public/p/{slug}/', 'GET')
print(f'Public profile status: {status}')
print(f'Public name: {pub_prof["profile"]["name"]}, Template: {pub_prof["profile"]["template_id"]}')
print(f'Skills ({len(pub_prof["profile"]["skills"])}): {[s["name"] for s in pub_prof["profile"]["skills"]]}')
assert status == 200

print('\n--- Step 7: Testing PUT /api/profiles/<id>/ (Update in MySQL) ---')
status, updated_prof = request(f'/api/profiles/{new_id}/', 'PUT', {
    'name': 'Sophia Chen',
    'title': 'Senior AI Research Scientist',
    'bio': 'Pioneering advanced foundation model architectures.',
    'email': 'sophia@example.com',
    'phone': '+65 9123 4567',
    'location': 'Singapore & Remote',
    'template_id': 'creative',
    'skills': [
        {'name': 'PyTorch', 'level': 98},
        {'name': 'LLM Fine-tuning', 'level': 94},
        {'name': 'Distributed Training', 'level': 90}
    ],
    'links': [
        {'platform': 'GitHub', 'url': 'https://github.com/sophiachen'},
        {'platform': 'LinkedIn', 'url': 'https://linkedin.com/in/sophiachen'}
    ]
}, token=token)
print(f'Update status: {status}, Updated Title: {updated_prof.get("title")}, Skills: {len(updated_prof.get("skills", []))}')
assert status == 200

print('\n--- Step 8: Testing GET /api/profiles/dashboard/stats/ ---')
status, stats_res = request('/api/profiles/dashboard/stats/', 'GET', token=token)
print(f'Stats status: {status}')
print(f'Stats data: {stats_res.get("stats")}')
assert status == 200

print('\n--- Step 9: Testing DELETE /api/profiles/<id>/ ---')
status, _ = request(f'/api/profiles/{new_id}/', 'DELETE', token=token)
print(f'Delete status: {status}')
assert status in (200, 204)

print('\n--- Step 10: Verify Deletion ---')
status, after_del = request(f'/api/public/p/{slug}/', 'GET')
print(f'Public lookup after delete status (expected 404): {status}')
assert status == 404

print('\n>>> ALL 10 END-TO-END VERIFICATION CHECKS PASSED PERFECTLY AGAINST DJANGO AND MYSQL! <<<')
