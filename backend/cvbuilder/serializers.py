from rest_framework import serializers


class StrictText(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class SourceSerializer(serializers.Serializer):
    title = StrictText(trim_whitespace=False)
    html = StrictText(trim_whitespace=False)
    css = StrictText(trim_whitespace=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs["title"].strip() or not attrs["html"].strip():
            raise serializers.ValidationError("Document name and HTML must not be blank.")
        return attrs


class ConfirmationSerializer(serializers.Serializer):
    confirmation = StrictText()
