
# urls.py
from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path('register/', views.register_patient),
    path('update/<int:patient_id>/', views.update_patient),
    path('update_visit/<int:patient_id>/', views.update_visit),

    path('search/', views.search_patient),
    path('day/', views.summary_by_day),
    path('range/', views.summary_between_dates),
    path('patient/<int:patient_id>/', views.summary_by_patient),
    path('add/', views.add_visit),
    path('login/', views.login_view),
    
    path('add_user/', views.add_user, name='add_user'),
    path('change_password/', views.change_password, name='change_password'),
    
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
