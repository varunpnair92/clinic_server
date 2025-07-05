
# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_patient),
    path('update/<int:patient_id>/', views.update_patient),
    path('update_visit/<int:patient_id>/', views.update_visit),

    path('search/', views.search_patient),
    path('day/', views.summary_by_day),
    path('range/', views.summary_between_dates),
    path('patient/<int:patient_id>/', views.summary_by_patient),
    path('add/', views.add_visit),
]
