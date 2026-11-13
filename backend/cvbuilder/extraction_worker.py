"""Disposable extraction process; no network or file persistence is needed."""
import base64
import json
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from .extraction import extract_document
from .errors import CvError


def main():
    try:
        from .process_limits import limit_memory
        limit_memory(int(os.getenv('CV_EXTRACT_MEMORY_MB', '512')))
        request = json.loads(sys.stdin.buffer.read())
        result = extract_document(base64.b64decode(request['data']), request['name'])
        output = json.dumps({'result': result})
        if len(output.encode('utf-8')) > 32 * 1024 * 1024:
            raise CvError('Extracted document output is too large. Simplify the document.', 422)
        print(output)
    except CvError as error:
        print(json.dumps({'error': str(error.detail), 'status': error.status_code}))
    except Exception:
        # Never expose parser internals or document data through a traceback.
        print(json.dumps({'error': 'The document could not be processed safely. Try a simpler document.', 'status': 422}))


if __name__ == '__main__':
    main()
