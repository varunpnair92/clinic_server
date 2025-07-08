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
    xray_url = serializers.SerializerMethodField()

    class Meta:
        model = VisitHistory
        fields = ['id', 'visit_date', 'reason', 'xray_url', 'prescriptions']

    def get_xray_url(self, obj):
        request = self.context.get('request')
        if obj.xray_image and hasattr(obj.xray_image, 'url'):
            url_path = obj.xray_image.url
            if request:
                return request.build_absolute_uri('/clinic' + url_path)
            return '/clinic' + url_path
        return None




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
        
        last_op = Patient.objects.order_by('-op_number').first()
        next_op = (last_op.op_number + 1) if last_op else 1000  # starting from 1000

        validated_data['op_number'] = next_op
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


#user serializer
from .models import AppUser

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        try:
            user = AppUser.objects.get(username=data['username'], password=data['password'])
        except AppUser.DoesNotExist:
            raise serializers.ValidationError("Invalid username or password")

        return {
            'id': user.id,
            'username': user.username,
            'role': user.role,
        }

