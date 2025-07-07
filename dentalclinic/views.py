

# views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from datetime import datetime
from .models import *
from .serializers import *

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
        Q(name__icontains=query) | Q(phone__icontains=query)
    ).distinct()

    if not patients.exists():
        return Response({'message': 'No patients found'}, status=404)

    serializer = PatientDetailSerializer(patients, many=True)
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

@api_view(['POST'])
def add_visit(request):
    patient_id = request.data.get('patient_id')
    reason = request.data.get('reason')
    prescription_data = request.data.get('prescriptions', [])

    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({'error': 'Patient not found'}, status=404)

    visit = VisitHistory.objects.create(patient=patient, reason=reason)
    for p in prescription_data:
        Prescription.objects.create(visit=visit, **p)

    return Response({'message': 'Visit added successfully'}, status=201)

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

