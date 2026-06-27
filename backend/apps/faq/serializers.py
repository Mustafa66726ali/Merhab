from rest_framework import serializers

from apps.faq.models import FAQItem


class FAQItemSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    answered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FAQItem
        fields = [
            "id",
            "question",
            "answer",
            "asker_name",
            "asker_email",
            "status",
            "status_label",
            "is_published",
            "sort_order",
            "answered_by",
            "answered_by_name",
            "created_at",
            "updated_at",
            "answered_at",
        ]
        read_only_fields = ["answered_by", "answered_at", "created_at", "updated_at"]

    def get_answered_by_name(self, obj):
        if obj.answered_by:
            return obj.answered_by.get_full_name() or obj.answered_by.email
        return ""


class FAQItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = [
            "question",
            "answer",
            "asker_name",
            "asker_email",
            "status",
            "is_published",
            "sort_order",
        ]


class FAQPublicSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ["question", "asker_name", "asker_email"]

    def create(self, validated_data):
        return FAQItem.objects.create(
            **validated_data,
            status=FAQItem.Status.PENDING,
            is_published=False,
        )


class FAQPublicListSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ["id", "question", "answer", "sort_order"]
