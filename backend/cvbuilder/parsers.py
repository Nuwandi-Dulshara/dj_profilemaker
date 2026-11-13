from rest_framework.parsers import BaseParser, JSONParser


class CvSourceJSONParser(BaseParser):
    """Read CV JSON from the authenticated request stream without a form-size cap.

    DRF 3.18 buffers instances of JSONParser through Django's capped request.body.
    Delegation preserves DRF's JSON validation without changing upload limits for
    other APIs or temporarily changing process-wide settings.
    """
    media_type = "application/json"

    def parse(self, stream, media_type=None, parser_context=None):
        return JSONParser().parse(stream, media_type, parser_context)
