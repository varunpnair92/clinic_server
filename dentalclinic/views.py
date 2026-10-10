

# views.py
import json
import csv
import io
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Count, Max, Case, When, Value, IntegerField
from django.utils import timezone
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from django.core.management import call_command
from datetime import datetime
from .models import *
from .serializers import *
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import parser_classes


@api_view(['POST'])
def register_patient(request):
    name = request.data.get('name')
    phone = request.data.get('phone')

    # Check if patient already exists
    try:
        existing = Patient.objects.get(name=name, phone=phone)
        return Response({
            'message': 'Patient already exists',
            'existing_op_number': existing.op_number,
        }, status=400)
    except Patient.DoesNotExist:
        pass

    # Continue with registration
    serializer = PatientWriteSerializer(data=request.data)
    if serializer.is_valid():
        patient = serializer.save()
        return Response({
            'id': patient.id,
            'name': patient.name,
            'op_number': patient.op_number,
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['PUT'])
def update_patient(request, patient_id):
    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=404)

    serializer = PatientWriteSerializer(patient, data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)



@api_view(['GET'])
def get_next_op(request):
    """
    Returns the next auto-assignable OP number for registration.
    """
    last_op = Patient.objects.order_by('-op_number').first()
    next_op = (last_op.op_number + 1) if last_op else 1000
    return Response({'next_op_number': next_op})


@api_view(['GET'])
def search_patient(request):
    """
    Searches patients by query or returns full patient list ordered by op_number DESC.
    """
    query = request.GET.get('q', '').strip()
    show_all = request.GET.get('all', '').strip()
    try:
        limit = int(request.GET.get('limit', 100))
    except (ValueError, TypeError):
        limit = 100
    try:
        offset = int(request.GET.get('offset', 0))
    except (ValueError, TypeError):
        offset = 0

    # View all patients ordered by OP number descending
    if show_all in ('1', 'true') or (not query and 'all' in request.GET):
        total_count = Patient.objects.count()
        patients = (
            Patient.objects
            .select_related('address')
            .order_by('-op_number')[offset:offset+limit]
        )
        data = [
            {
                'id': p.id,
                'name': p.name,
                'age': p.age,
                'dob': p.dob.strftime('%Y-%m-%d') if p.dob else None,
                'gender': p.gender,
                'phone': p.phone,
                'op_number': p.op_number,
                'address': {'address': p.address.address if hasattr(p, 'address') and p.address else ''},
            }
            for p in patients
        ]
        return Response({
            'patients': data,
            'total_count': total_count,
            'offset': offset,
            'limit': limit,
            'has_more': (offset + limit) < total_count,
        })

    if not query:
        return Response([], status=200)

    # When query starts with '#', search ONLY by OP number (no name, phone, or other fields)
    if query.startswith('#'):
        op_query = query.lstrip('#').strip()
        if not op_query:
            return Response([], status=200)

        qs = Patient.objects.filter(op_number__icontains=op_query).select_related('address')
        if op_query.isdigit():
            exact_op = int(op_query)
            qs = qs.annotate(
                is_exact=Case(
                    When(op_number=exact_op, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            ).order_by('-is_exact', '-op_number')
        else:
            qs = qs.order_by('-op_number')

        patients = qs[:100]
        if not patients.exists():
            return Response({'message': 'No patients found'}, status=404)

        data = [
            {
                'id': p.id,
                'name': p.name,
                'age': p.age,
                'dob': p.dob.strftime('%Y-%m-%d') if p.dob else None,
                'gender': p.gender,
                'phone': p.phone,
                'op_number': p.op_number,
                'address': {'address': p.address.address if hasattr(p, 'address') and p.address else ''},
            }
            for p in patients
        ]
        return Response(data)

    # General search (name, phone, op_number)
    patients = (
        Patient.objects.filter(
            Q(name__icontains=query) |
            Q(phone__icontains=query) |
            Q(op_number__icontains=query)
        )
        .select_related('address')
        .order_by('-op_number')[:100]
    )

    if not patients.exists():
        return Response({'message': 'No patients found'}, status=404)

    data = [
        {
            'id': p.id,
            'name': p.name,
            'age': p.age,
            'dob': p.dob.strftime('%Y-%m-%d') if p.dob else None,
            'gender': p.gender,
            'phone': p.phone,
            'op_number': p.op_number,
            'address': {'address': p.address.address if hasattr(p, 'address') and p.address else ''},
        }
        for p in patients
    ]
    return Response(data)




@api_view(['GET'])
def summary_by_day(request):
    date_str = request.GET.get('date')
    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return Response({'error': 'Invalid date format'}, status=400)

    visits = VisitHistory.objects.filter(visit_date__date=date)
    serializer = VisitHistorySerializer(visits, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['GET'])
def summary_between_dates(request):
    start = request.GET.get('start')
    end = request.GET.get('end')
    try:
        start_date = datetime.strptime(start, '%Y-%m-%d').date()
        end_date = datetime.strptime(end, '%Y-%m-%d').date()
    except:
        return Response({'error': 'Invalid date format'}, status=400)

    visits = VisitHistory.objects.filter(visit_date__date__range=(start_date, end_date))
    serializer = VisitHistorySerializer(visits, many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['GET'])
def summary_by_patient(request, patient_id):
    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=404)

    serializer = PatientDetailSerializer(patient, context={'request': request})
    return Response(serializer.data)



@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def add_visit(request):
    patient_id = request.data.get('patient_id')
    reason = request.data.get('reason')
    prescription_data = request.data.get('prescriptions', [])

    # Fix: convert from string to list if needed
    if isinstance(prescription_data, str):
        try:
            prescription_data = json.loads(prescription_data)
        except json.JSONDecodeError:
            return Response({'error': 'Invalid prescription format'}, status=400)

    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=404)

    # ✅ Check for xray image in request.FILES
    xray_file = request.FILES.get('xray')

    # ✅ Save visit with image if present
    visit = VisitHistory.objects.create(
        patient=patient,
        reason=reason,
        xray_image=xray_file if xray_file else None
    )

    # ✅ Save prescriptions
    for p in prescription_data:
        if isinstance(p, dict):
            Prescription.objects.create(visit=visit, **p)

    # Automatically transition any active queue waiting entry to completed today
    from django.utils import timezone
    today = timezone.localdate()
    PatientQueue.objects.filter(
        patient=patient,
        queue_date=today,
        status='waiting'
    ).update(status='completed', completed_at=timezone.now())

    return Response({'message': 'Visit added successfully', 'visit_id': visit.id}, status=201)




@api_view(['PUT'])
def update_visit(request, visit_id):
    try:
        visit = VisitHistory.objects.get(id=visit_id)
    except VisitHistory.DoesNotExist:
        return Response({'error': 'Visit not found'}, status=404)

    data = request.data.copy()
    data.pop('patient_id', None)  # Remove patient_id if present

    # Update prescriptions if provided
    if 'prescriptions' in request.data or 'prescription' in request.data:
        prescription_data = request.data.get('prescriptions')
        single_prescription = request.data.get('prescription')

        visit.prescriptions.all().delete()
        if prescription_data:
            if isinstance(prescription_data, str):
                try:
                    prescription_data = json.loads(prescription_data)
                except json.JSONDecodeError:
                    lines = [line.strip() for line in prescription_data.splitlines() if line.strip()]
                    prescription_data = [{'medicine_name': line, 'instructions': ''} for line in lines]
            if isinstance(prescription_data, list):
                for p in prescription_data:
                    if isinstance(p, dict):
                        Prescription.objects.create(visit=visit, **p)
                    elif isinstance(p, str) and p.strip():
                        Prescription.objects.create(visit=visit, medicine_name=p.strip(), instructions='')
        elif single_prescription:
            if isinstance(single_prescription, str):
                lines = [line.strip() for line in single_prescription.splitlines() if line.strip()]
                for line in lines:
                    Prescription.objects.create(visit=visit, medicine_name=line, instructions='')
            elif isinstance(single_prescription, list):
                for p in single_prescription:
                    if isinstance(p, dict):
                        Prescription.objects.create(visit=visit, **p)
                    elif isinstance(p, str) and p.strip():
                        Prescription.objects.create(visit=visit, medicine_name=p.strip(), instructions='')

    serializer = VisitHistorySerializer(visit, data=data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(['DELETE'])
def delete_visit(request, visit_id):
    try:
        visit = VisitHistory.objects.get(id=visit_id)
        visit.delete()
        return Response({'message': 'Visit deleted successfully.'}, status=status.HTTP_200_OK)
    except VisitHistory.DoesNotExist:
        return Response({'error': 'Visit not found.'}, status=status.HTTP_404_NOT_FOUND)


#login view

from .serializers import LoginSerializer

@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        return Response(serializer.validated_data)
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)




from .serializers import UserCreateSerializer, PasswordChangeSerializer


@api_view(['POST'])
def add_user(request):
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'User created successfully'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


#delete patient
@api_view(['DELETE'])
def delete_patient(request, patient_id):
    try:
        patient = Patient.objects.get(id=patient_id)
        patient.delete()
        return Response({'message': 'Patient deleted successfully.'}, status=status.HTTP_200_OK)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def recent_visits(request):
    """
    Get most recent clinic visits with patient details.
    Query param: limit (default 20, max 100).
    """
    try:
        limit = min(int(request.GET.get('limit', 20)), 100)
    except (ValueError, TypeError):
        limit = 20

    visits = (
        VisitHistory.objects
        .select_related('patient')
        .prefetch_related('prescriptions')
        .order_by('-visit_date')[:limit]
    )
    serializer = VisitHistorySerializer(visits, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
def clinic_stats(request):
    """
    Returns quick clinic overview stats.
    """
    from datetime import date
    today = date.today()
    total_patients = Patient.objects.count()
    today_visits = VisitHistory.objects.filter(visit_date__date=today).count()
    total_visits = VisitHistory.objects.count()
    return Response({
        'total_patients': total_patients,
        'today_visits': today_visits,
        'total_visits': total_visits,
    })


@api_view(['GET'])
def list_users(request):
    """
    List staff accounts (excluding password hashes).
    """
    users = AppUser.objects.all().order_by('role', 'username')
    data = [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]
    return Response(data)


def app_view(request):
    """
    Renders the Single Page Application clinic dashboard.
    """
    return render(request, 'index.html')


import csv
import io
from django.http import HttpResponse
from django.core.management import call_command
from django.db.models import Count, Max


@api_view(['GET'])
def export_patients_csv(request):
    """
    Exports all patients with contact info and visit stats to a CSV file.
    """
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    filename = f"patients_export_{datetime.now().strftime('%Y-%m-%d')}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow([
        'OP Number', 'Patient Name', 'Age', 'Date of Birth',
        'Gender', 'Phone', 'Address', 'Total Visits', 'Last Visit Date'
    ])

    patients = (
        Patient.objects
        .select_related('address')
        .annotate(
            total_visits=Count('visits'),
            last_visit=Max('visits__visit_date')
        )
        .order_by('op_number')
    )

    for p in patients.iterator(chunk_size=500):
        addr_str = p.address.address if hasattr(p, 'address') and p.address else ''
        dob_str = p.dob.strftime('%Y-%m-%d') if p.dob else ''
        last_visit_str = timezone.localtime(p.last_visit).strftime('%Y-%m-%d %I:%M %p') if p.last_visit else 'Never'
        writer.writerow([
            p.op_number,
            p.name,
            p.age,
            dob_str,
            p.gender,
            p.phone,
            addr_str,
            p.total_visits,
            last_visit_str
        ])

    return response


@api_view(['GET'])
def export_visits_csv(request):
    """
    Exports all consultation visits with patient details and prescriptions to CSV.
    """
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    filename = f"visits_export_{datetime.now().strftime('%Y-%m-%d')}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow([
        'Visit ID', 'Date & Time', 'OP Number', 'Patient Name',
        'Patient Phone', 'Diagnosis / Remarks', 'Prescriptions', 'Has X-Ray'
    ])

    visits = (
        VisitHistory.objects
        .select_related('patient')
        .prefetch_related('prescriptions')
        .order_by('-visit_date')
    )

    for v in visits.iterator(chunk_size=500):
        rx_list = [
            f"{p.medicine_name} ({p.instructions})" if p.instructions else p.medicine_name
            for p in v.prescriptions.all()
        ]
        rx_str = " | ".join(rx_list)
        v_date = timezone.localtime(v.visit_date).strftime('%Y-%m-%d %I:%M %p') if v.visit_date else ''
        has_xray = 'Yes' if v.xray_image else 'No'

        writer.writerow([
            v.id,
            v_date,
            v.patient.op_number if v.patient else '',
            v.patient.name if v.patient else '',
            v.patient.phone if v.patient else '',
            v.reason,
            rx_str,
            has_xray
        ])

    return response


@api_view(['GET'])
def download_db_backup(request):
    """
    Generates a full JSON database dump of the dental clinic application.
    """
    buffer = io.StringIO()
    call_command('dumpdata', 'dentalclinic', indent=2, stdout=buffer)

    response = HttpResponse(buffer.getvalue(), content_type='application/json')
    filename = f"clinic_db_backup_{timezone.localtime(timezone.now()).strftime('%Y-%m-%d_%H%M')}.json"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
def clinic_metrics(request):
    """
    Returns comprehensive database and clinic metrics for Admin panel.
    """
    total_patients = Patient.objects.count()
    total_visits = VisitHistory.objects.count()
    total_prescriptions = Prescription.objects.count()
    total_users = AppUser.objects.count()
    latest_visit = VisitHistory.objects.order_by('-visit_date').first()
    latest_visit_str = timezone.localtime(latest_visit.visit_date).strftime('%Y-%m-%d %I:%M %p') if latest_visit else 'None'

    return Response({
        'total_patients': total_patients,
        'total_visits': total_visits,
        'total_prescriptions': total_prescriptions,
        'total_users': total_users,
        'latest_visit': latest_visit_str,
        'database_name': 'pscdb (PostgreSQL)',
    })


# ==============================================================================
# PATIENT QUEUE & ADMISSION TOKEN SYSTEM (Live Doctor / Reception Queue)
# ==============================================================================
@api_view(['GET'])
def get_today_queue(request):
    """
    Returns today's active waiting queue and completed queue for the doctor desk.
    Automatically resets each day since entries are filtered by today's date.
    """
    from django.utils import timezone
    today = timezone.localdate()

    waiting = (
        PatientQueue.objects.filter(queue_date=today, status='waiting')
        .select_related('patient', 'patient__address')
        .order_by('token_number')
    )
    completed = (
        PatientQueue.objects.filter(queue_date=today, status='completed')
        .select_related('patient', 'patient__address')
        .order_by('-completed_at')
    )

    return Response({
        'date': today.strftime('%Y-%m-%d'),
        'waiting': PatientQueueSerializer(waiting, many=True).data,
        'completed': PatientQueueSerializer(completed, many=True).data,
        'pending_count': waiting.count(),
        'completed_count': completed.count(),
        'total_tokens': waiting.count() + completed.count(),
    })


@api_view(['POST'])
def admit_to_queue(request):
    """
    Receptionist admits a patient to today's doctor queue, issuing a sequential token.
    """
    from django.utils import timezone
    from django.shortcuts import get_object_or_404
    from django.db.models import Max

    patient_id = request.data.get('patient_id')
    if not patient_id:
        return Response({'error': 'patient_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    patient = get_object_or_404(Patient, id=patient_id)
    today = timezone.localdate()

    # If patient is already waiting today, return existing token
    existing = PatientQueue.objects.filter(patient=patient, queue_date=today, status='waiting').first()
    if existing:
        return Response({
            'message': f"{patient.name} is already waiting with Token #{existing.token_number}",
            'entry': PatientQueueSerializer(existing).data,
            'already_waiting': True
        }, status=status.HTTP_200_OK)

    # Next token number for today (starts from 1 each day)
    max_token = PatientQueue.objects.filter(queue_date=today).aggregate(Max('token_number'))['token_number__max'] or 0
    next_token = max_token + 1

    entry = PatientQueue.objects.create(
        patient=patient,
        token_number=next_token,
        status='waiting'
    )

    return Response({
        'message': f"Admitted {patient.name} (Token #{next_token})",
        'entry': PatientQueueSerializer(entry).data,
        'already_waiting': False
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def complete_queue_entry(request, entry_id=None):
    """
    Marks a queue entry as completed. Can be called by queue entry ID or patient_id.
    """
    from django.utils import timezone
    from django.shortcuts import get_object_or_404
    today = timezone.localdate()

    entry = None
    if entry_id:
        entry = get_object_or_404(PatientQueue, id=entry_id)
    else:
        patient_id = request.data.get('patient_id')
        if patient_id:
            entry = PatientQueue.objects.filter(patient_id=patient_id, queue_date=today, status='waiting').first()

    if not entry:
        return Response({'error': 'No active waiting queue entry found'}, status=status.HTTP_404_NOT_FOUND)

    entry.status = 'completed'
    entry.completed_at = timezone.now()
    entry.save()

    return Response({
        'message': f"Token #{entry.token_number} ({entry.patient.name}) marked as completed",
        'entry': PatientQueueSerializer(entry).data
    })


@api_view(['DELETE', 'POST'])
def remove_queue_entry(request, entry_id):
    """
    Removes a patient from today's queue.
    """
    from django.shortcuts import get_object_or_404
    entry = get_object_or_404(PatientQueue, id=entry_id)
    patient_name = entry.patient.name
    token_num = entry.token_number
    entry.delete()

    return Response({
        'message': f"Token #{token_num} ({patient_name}) removed from queue."
    })


