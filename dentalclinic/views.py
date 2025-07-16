

# views.py
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from datetime import datetime
from .models import *
from .serializers import *
from rest_framework.parsers import MultiPartParser, FormParser
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
def search_patient(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response([], status=200)

    patients = Patient.objects.filter(
        Q(name__istartswith=query) |
        Q(phone__istartswith=query) |
        Q(op_number__istartswith=query)
    ).distinct()

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
    serializer = VisitHistorySerializer(visits, many=True)
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
    serializer = VisitHistorySerializer(visits, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def summary_by_patient(request, patient_id):
    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=404)

    serializer = PatientDetailSerializer(patient)
    return Response(serializer.data)



import json
from datetime import datetime
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from .models import Patient, VisitHistory, Prescription

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def add_visit(request):
    patient_id = request.data.get('patient_id')
    reason = request.data.get('reason')
    prescription_data = request.data.get('prescriptions', [])
    visit_date_str = request.data.get('visit_date')  # Optional date from frontend

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

    # Optional: Parse visit_date if provided
    visit_date = None
    if visit_date_str:
        try:
            visit_date = datetime.fromisoformat(visit_date_str)
        except ValueError:
            return Response({'error': 'Invalid visit_date format (Expected ISO 8601)'}, status=400)

    # Handle xray image
    xray_file = request.FILES.get('xray')

    # Save visit with optional visit_date
    visit = VisitHistory.objects.create(
        patient=patient,
        reason=reason,
        xray_image=xray_file if xray_file else None,
        visit_date=visit_date  # Will be None if not provided (model default applies)
    )

    # Save prescriptions
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

    serializer = VisitHistorySerializer(visit, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


#login view

from .serializers import LoginSerializer

@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        return Response(serializer.validated_data)
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

