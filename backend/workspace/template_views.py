from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .views import PrivateView, Pagination
from .models import SavedTemplate, TemplatePreference, Document
from . import templates
from .documents import RevisionConflict


def listing(request, items):
    params = request.query_params
    search = params.get('search', '').strip().lower()[:200]
    if search:
        items = [x for x in items if search in (x['name'] + ' ' + x['description']).lower()]
    for key, field in [('category', 'categories'), ('career', 'careers'), ('layout', 'layout'), ('ats_risk', 'ats_risk')]:
        value = params.get(key, '')
        if value and value != 'all':
            # All structured CV layouts can extend across multiple pages.
            if key == 'layout' and value == 'multi-page':
                continue
            items = [x for x in items if value.lower() in ([str(v).lower() for v in x[field]] if isinstance(x[field], list) else [x[field].lower()])]
    for key in ['favorite', 'recent']:
        value = params.get(key, '')
        if value and value != 'all':
            if value not in ['true', 'false', '1', '0']:
                raise ValidationError({key: 'Send true or false.'})
            expected = value in ['true', '1']
            items = [x for x in items if bool(x['favorite'] if key == 'favorite' else x['last_used_at']) == expected]
    ordering = params.get('ordering', 'name')
    if ordering not in ['name', '-name', 'last_used_at', '-last_used_at', 'recent']:
        raise ValidationError({'ordering': 'Choose name, -name, last_used_at or -last_used_at.'})
    if ordering in ['name', '-name']:
        items.sort(key=lambda x: (x['name'].lower(), x['id']), reverse=ordering.startswith('-'))
    else:
        items.sort(key=lambda x: (x['last_used_at'].isoformat() if x['last_used_at'] else '', x['id']), reverse=ordering != 'last_used_at')
    pagination = Pagination()
    page = pagination.paginate_queryset(items, request)
    return pagination.get_paginated_response(page)


class TemplatesView(PrivateView):
    def get(self, request):
        return listing(request, templates.personalize(request.user, templates.original_templates()))


class TemplateDetailView(PrivateView):
    def get(self, request, template_id):
        return Response(templates.personalize(request.user, [templates.resolve_template(request.user, template_id)])[0])


class TemplateFavoriteView(PrivateView):
    def post(self, request, template_id):
        template = templates.resolve_template(request.user, template_id)
        favorite = request.data.get('favorite')
        if not isinstance(favorite, bool):
            raise ValidationError({'favorite': 'Send a boolean.'})
        TemplatePreference.objects.update_or_create(owner=request.user, template_id=template['id'], defaults={'favorite': favorite})
        return Response(templates.personalize(request.user, [template])[0])


class MyTemplatesView(PrivateView):
    def get(self, request):
        items = [templates.custom_metadata(t) for t in SavedTemplate.objects.filter(owner=request.user)]
        return listing(request, templates.personalize(request.user, items))

    def post(self, request):
        saved = SavedTemplate.objects.create(owner=request.user, **templates.validated_custom(request.data))
        return Response(templates.custom_metadata(saved), status=201)


class MyTemplateDetailView(PrivateView):
    def get(self, request, pk):
        saved = get_object_or_404(SavedTemplate, owner=request.user, pk=pk)
        return Response(templates.personalize(request.user, [templates.custom_metadata(saved)])[0])

    def patch(self, request, pk):
        saved = get_object_or_404(SavedTemplate, owner=request.user, pk=pk)
        for key, value in templates.validated_custom(request.data, saved).items():
            setattr(saved, key, value)
        saved.save()
        return Response(templates.personalize(request.user, [templates.custom_metadata(saved)])[0])

    def delete(self, request, pk):
        saved = get_object_or_404(SavedTemplate, owner=request.user, pk=pk)
        TemplatePreference.objects.filter(owner=request.user, template_id=str(saved.pk)).delete()
        saved.delete()
        return Response(status=204)


class MyTemplateDuplicateView(PrivateView):
    def post(self, request, pk):
        saved = get_object_or_404(SavedTemplate, owner=request.user, pk=pk)
        duplicate = SavedTemplate.objects.create(owner=request.user, name=saved.name[:113] + ' (copy)', description=saved.description, design=saved.design)
        return Response(templates.custom_metadata(duplicate), status=201)


class SwitchTemplateView(PrivateView):
    def post(self, request, pk):
        try:
            return Response(templates.switch_template(request.user, pk, request.data))
        except RevisionConflict as exc:
            revision = Document.objects.filter(project_id=pk, project__owner=request.user).values_list('revision', flat=True).first()
            return Response({'detail': str(exc.detail), 'revision': revision}, status=409)
