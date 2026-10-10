
# urls.py
from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path('', views.app_view, name='clinic_app'),
    path('app/', views.app_view, name='clinic_app_alt'),

    path('register/', views.register_patient),
    path('next_op/', views.get_next_op, name='get_next_op'),
    path('update/<int:patient_id>/', views.update_patient),
    path('update_visit/<int:visit_id>/', views.update_visit, name='update_visit'),
    path('delete_visit/<int:visit_id>/', views.delete_visit, name='delete_visit'),

    path('search/', views.search_patient),
    path('day/', views.summary_by_day),
    path('range/', views.summary_between_dates),
    path('patient/<int:patient_id>/', views.summary_by_patient),
    path('add/', views.add_visit),
    path('login/', views.login_view),
    
    path('add_user/', views.add_user, name='add_user'),
    path('change_password/', views.change_password, name='change_password'),
    path('delete/<int:patient_id>/', views.delete_patient, name='delete_patient'),

    path('recent_visits/', views.recent_visits, name='recent_visits'),
    path('stats/', views.clinic_stats, name='clinic_stats'),
    path('users/', views.list_users, name='list_users'),

    path('export/patients/', views.export_patients_csv, name='export_patients'),
    path('export/visits/', views.export_visits_csv, name='export_visits'),
    path('export/backup/', views.download_db_backup, name='download_db_backup'),
    path('metrics/', views.clinic_metrics, name='clinic_metrics'),

    # Patient Queue & Admission Token Endpoints
    path('queue/today/', views.get_today_queue, name='today_queue'),
    path('queue/admit/', views.admit_to_queue, name='admit_to_queue'),
    path('queue/<int:entry_id>/complete/', views.complete_queue_entry, name='complete_queue_entry'),
    path('queue/complete/', views.complete_queue_entry, name='complete_queue_patient'),
    path('queue/<int:entry_id>/remove/', views.remove_queue_entry, name='remove_queue_entry'),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
