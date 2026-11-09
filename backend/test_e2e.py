import urllib.request
import urllib.parse
import json

BASE_URL = 'http://127.0.0.1:8000'

def request(path, method='GET', data=None, token=None, accept='*/*'):
    headers = {'Content-Type': 'application/json', 'Accept': accept}
    if token:
        headers['Authorization'] = f'Token {token}'
    req_data = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(f'{BASE_URL}{path}', data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read()
            try:
                decoded = body.decode('utf-8')
                return response.status, json.loads(decoded)
            except Exception:
                return response.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body

print('--- Step 1: Testing User Login ---')
status, res = request('/api/auth/login/', 'POST', {
    'email': 'alex@example.com',
    'password': 'password123'
})
print(f'Login status: {status}, token obtained: {bool(res.get("token"))}')
assert status == 200 and 'token' in res, 'Login failed!'
token = res['token']

print('\n--- Step 2: Confirming API documentation is removed ---')
for path in ('/api/docs/', '/api/schema/', '/api/redoc/'):
    status, _ = request(path, 'GET')
    print(f'{path} status: {status}')
    assert status == 404

import uuid
test_unique_id = uuid.uuid4().hex[:6]
test_slug = f'elena-rostova-{test_unique_id}'

print('\n--- Step 3: Testing POST /api/profiles/ with Experience, Education & Projects ---')
status, new_prof = request('/api/profiles/', 'POST', {
    'name': 'Elena Rostova',
    'title': 'Lead AI System Architect',
    'bio': 'Designing robust distributed neural architectures.',
    'email': 'elena@example.com',
    'phone': '+1 415 555 2671',
    'location': 'San Francisco, CA',
    'template_id': 'developer',
    'slug': test_slug,
    'skills': [
        {'name': 'Distributed Systems', 'level': 95},
        {'name': 'PyTorch & CUDA', 'level': 90}
    ],
    'links': [
        {'platform': 'GitHub', 'url': 'https://github.com/elena'}
    ],
    'experiences': [
        {
            'role': 'Principal AI Engineer',
            'company': 'Quantum Neural Labs',
            'startDate': '2022 - Present',
            'description': 'Leading high-throughput inference optimization pipelines.'
        }
    ],
    'education': [
        {
            'degree': 'Ph.D. in Computer Science',
            'institution': 'Stanford University',
            'startDate': '2016 - 2021'
        }
    ],
    'projects': [
        {
            'title': 'TensorStream Engine',
            'description': 'Real-time multi-GPU model routing framework.',
            'demoUrl': 'https://example.com/demo',
            'githubUrl': 'https://github.com/elena/tensorstream',
            'tags': 'C++, CUDA, Python'
        }
    ]
}, token=token)
print(f'Create status: {status}, ID: {new_prof.get("id")}, Slug: {new_prof.get("slug")}')
assert status == 201
new_id = new_prof['id']
slug = new_prof['slug']

print('\n--- Step 4: Testing Public Profile View & Analytics Tracking ---')
status, pub_prof = request(f'/api/public/p/{slug}/', 'GET')
print(f'Public profile status: {status}')
print(f'Experiences: {len(pub_prof["profile"].get("experiences", []))}')
print(f'Education: {len(pub_prof["profile"].get("education", []))}')
print(f'Projects: {len(pub_prof["profile"].get("projects", []))}')
print(f'Views count: {pub_prof["profile"].get("views_count")}')
assert status == 200
assert len(pub_prof["profile"]["experiences"]) == 1
assert len(pub_prof["profile"]["education"]) == 1
assert len(pub_prof["profile"]["projects"]) == 1

print('\n--- Step 5: Testing QR Code Generation Endpoint ---')
status, qr_bytes = request(f'/api/profiles/{new_id}/qr/', 'GET')
print(f'QR code status: {status}, bytes: {len(qr_bytes)}')
assert status == 200 and len(qr_bytes) > 100

print('\n--- Step 6: Testing PDF Resume Generation Endpoint ---')
status, pdf_bytes = request(f'/api/profiles/{new_id}/pdf/', 'GET')
print(f'PDF resume status: {status}, bytes: {len(pdf_bytes)}')
assert status == 200 and len(pdf_bytes) > 500

print('\n--- Step 7: Testing Public Contact Message Submission ---')
status, contact_res = request(f'/api/public/p/{slug}/contact/', 'POST', {
    'sender_name': 'David Miller',
    'sender_email': 'david@enterprise.com',
    'subject': 'Advisory Role',
    'message': 'Hi Elena, we would love to discuss an advisory role.'
})
print(f'Contact message status: {status}, raw response: {contact_res}')
if isinstance(contact_res, dict):
    print(f'Contact message response: {contact_res.get("message")}')
assert status == 201

print('\n--- Step 8: Testing Account Settings Update ---')
status, settings_res = request('/api/auth/settings/', 'PUT', {
    'name': 'Alex Morgan Updated',
}, token=token)
print(f'Settings update status: {status}, name: {settings_res.get("user", {}).get("name")}')
assert status == 200

print('\n--- Step 9: Testing Forgot Password Request ---')
status, forgot_res = request('/api/auth/forgot-password/', 'POST', {
    'email': 'alex@example.com'
})
print(f'Forgot password status: {status}, message: {forgot_res.get("message")}')
assert status == 200

print('\n--- Step 10: Cleaning up created test profile ---')
status, _ = request(f'/api/profiles/{new_id}/', 'DELETE', token=token)
print(f'Delete status: {status}')
assert status in (200, 204)

print('\n>>> ALL 10 ADVANCED BACKEND TESTS PASSED CLEANLY ON DJANGO & MYSQL! <<<')
