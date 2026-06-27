from rest_framework import viewsets
from .models import Message
from .serializers import MessageSerializer


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    filterset_fields = ["event", "guest", "direction", "is_read"]

    def get_queryset(self):
        return Message.objects.select_related("guest", "sender").all()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
