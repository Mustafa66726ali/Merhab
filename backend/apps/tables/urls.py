from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SeatingPlanViewSet, TableViewSet, TableSeatViewSet

router = DefaultRouter()
router.register("plans", SeatingPlanViewSet, basename="seating-plan")
router.register("tables", TableViewSet, basename="table")
router.register("seats", TableSeatViewSet, basename="seat")

urlpatterns = [
    path("", include(router.urls)),
]
