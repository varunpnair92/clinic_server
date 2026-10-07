

# views.py
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from datetime import datetime
from .models import *
from .serializers import *
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import parser_classes
from django.shortcuts import render


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
def search_patient(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response([], status=200)

    patients = Patient.objects.filter(
        Q(name__icontains=query) |
        Q(phone__icontains=query) |
        Q(op_number__icontains=query)
    ).distinct()[:50]

    if not patients.exists():
        return Response({'message': 'No patients found'}, status=404)

    serializer = PatientDetailSerializer(patients, many=True, context={'request': request})
    return Response(serializer.data)




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

