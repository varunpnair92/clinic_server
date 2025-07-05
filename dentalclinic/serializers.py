from rest_framework import serializers
from .models import Patient, PatientAddress, VisitHistory, Prescription


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientAddress
        fields = ['address']


class PrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prescription
        fields = ['medicine_name', 'instructions']


class VisitHistorySerializer(serializers.ModelSerializer):
    prescriptions = PrescriptionSerializer(many=True, read_only=True)

    class Meta:
        model = VisitHistory
        fields = ['visit_date', 'reason', 'prescriptions']


class PatientDetailSerializer(serializers.ModelSerializer):
    address = AddressSerializer(read_only=True)
    visits = VisitHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'age', 'gender', 'phone', 'address', 'visits']


class PatientWriteSerializer(serializers.ModelSerializer):
    address = AddressSerializer()

    class Meta:
        model = Patient
        fields = ['id', 'name', 'age', 'gender', 'phone', 'address']

    def create(self, validated_data):
        address_data = validated_data.pop('address')
        patient = Patient.objects.create(**validated_data)
        PatientAddress.objects.create(patient=patient, **address_data)
        return patient

    def update(self, instance, validated_data):
        address_data = validated_data.pop('address', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if address_data:
            PatientAddress.objects.update_or_create(
                patient=instance,
                defaults=address_data
            )

        return instance
