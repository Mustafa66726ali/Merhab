from rest_framework import serializers
from .models import SeatingPlan, Table, TableSeat


class SeatingPlanSerializer(serializers.ModelSerializer):
    tables_count = serializers.SerializerMethodField()

    class Meta:
        model = SeatingPlan
        fields = ["id", "event", "name", "description", "order", "tables_count", "created_at"]
        read_only_fields = ["created_at"]

    def get_tables_count(self, obj):
        return obj.tables.count()


class TableSeatSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source="guest.full_name", read_only=True)

    class Meta:
        model = TableSeat
        fields = ["id", "guest", "guest_name", "seat_number"]


class TableSerializer(serializers.ModelSerializer):
    seats = TableSeatSerializer(many=True, read_only=True)
    occupied_seats = serializers.SerializerMethodField()
    section_name = serializers.CharField(source="section.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = Table
        fields = [
            "id", "event", "plan", "plan_name", "section", "section_name",
            "group", "group_name", "name", "capacity", "shape",
            "position_x", "position_y", "seat_positions", "seats", "occupied_seats",
        ]

    def get_occupied_seats(self, obj):
        return obj.seats.filter(guest__isnull=False).count()
