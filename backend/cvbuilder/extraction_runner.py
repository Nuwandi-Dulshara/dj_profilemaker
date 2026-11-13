"""Keep potentially expensive parsing out of web worker state, with a deadline."""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
from django.conf import settings
from .errors import CvError


def extract_upload(data, name):
    if not data or len(data) > settings.CV_UPLOAD_MAX_BYTES:
        raise CvError('The upload is empty or exceeds the configured size limit.')
    payload = json.dumps({'name': name, 'data': base64.b64encode(data).decode()}).encode()
    try:
        process = subprocess.run([sys.executable, '-m', 'cvbuilder.extraction_worker'], input=payload,
                                 cwd=Path(__file__).resolve().parent.parent, capture_output=True, timeout=60,
                                 env={**os.environ, 'DJANGO_SETTINGS_MODULE': os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings'),
                                      'CV_UPLOAD_MAX_BYTES': str(settings.CV_UPLOAD_MAX_BYTES),
                                      'CV_TESSERACT_COMMAND': str(settings.CV_TESSERACT_COMMAND),
                                      'CV_OCR_LANGUAGE': str(settings.CV_OCR_LANGUAGE)})
        if process.returncode:
            raise CvError('Document extraction failed. Try a simpler document.', 422)
        result = json.loads(process.stdout)
        if 'error' in result:
            raise CvError(result['error'], result.get('status', 422))
        return result['result']
    except subprocess.TimeoutExpired:
        raise CvError('Document extraction exceeded 60 seconds. Try a smaller or simpler file.', 422) from None
    except (OSError, ValueError, KeyError):
        raise CvError('Document extraction is unavailable. Check the server dependencies.', 503) from None
