from django.http import HttpResponse
from django.utils.http import content_disposition_header
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from cvbuilder.cloud import filename
from cvbuilder.rendering import render_pdf
from .resume_pdf import resume_source
from .resume_links import add_resume_links


class ResumeAnonThrottle(AnonRateThrottle):
    rate = '10/min'
    scope = 'resume-anon'


class ResumeUserThrottle(UserRateThrottle):
    rate = '30/min'
    scope = 'resume-user'


class ProfileResumeView(APIView):
    # Existing public-profile downloads remain available. Only submitted text
    # is rendered; no private profiles or remote resources are fetched or saved.
    permission_classes = [AllowAny]
    throttle_classes = [ResumeAnonThrottle, ResumeUserThrottle]

    def post(self, request):
        source = resume_source(request.data)
        response = HttpResponse(add_resume_links(render_pdf(source), source['links']), content_type='application/pdf')
        response['Content-Disposition'] = content_disposition_header(True, filename(source['title'], '.pdf'))
        response['Cache-Control'] = 'no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
