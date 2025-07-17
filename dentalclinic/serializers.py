from datetime import date
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
    visit_date = serializers.SerializerMethodField()

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
    
    def get_visit_date(self, obj):
        # Format: YYYY-MM-DD HH:MM (no seconds or microseconds)
        return obj.visit_date.strftime('%Y-%m-%d %H:%M') if obj.visit_date else None





from datetime import date

class PatientDetailSerializer(serializers.ModelSerializer):
    address = AddressSerializer(read_only=True)
    visits = VisitHistorySerializer(many=True, read_only=True)
    last_visit_days_ago = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()  # Override the age field

    class Meta:
        model = Patient
        fields = [
            'id', 'name', 'age', 'dob','gender', 'phone', 'address',
            'visits', 'last_visit_days_ago', 'op_number'
        ]

    def get_last_visit_days_ago(self, obj):
        last_visit = obj.visits.order_by('-visit_date').first()
        if last_visit and last_visit.visit_date:
            days_ago = (date.today() - last_visit.visit_date.date()).days
            return f"{days_ago} days ago"
        return "No visits yet"

    def get_age(self, obj):
        if obj.dob:
            today = date.today()
            return today.year - obj.dob.year - ((today.month, today.day) < (obj.dob.month, obj.dob.day))
        return obj.age  # fallback to stored age



class PatientWriteSerializer(serializers.ModelSerializer):
    address = AddressSerializer()

    class Meta:
        model = Patient
        fields = ['id', 'name', 'dob', 'age', 'gender', 'phone', 'address']

    def calculate_age_from_dob(self, dob):
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    def create(self, validated_data):
        address_data = validated_data.pop('address')

        dob = validated_data.get('dob')
        if dob:
            validated_data['age'] = self.calculate_age_from_dob(dob)  # 🔑 Auto calculate age from dob

        validated_data.pop('id', None)  # Ensure no manual ID override

        last_op = Patient.objects.order_by('-op_number').first()
        next_op = (last_op.op_number + 1) if last_op else 1000
        validated_data['op_number'] = next_op

        patient = Patient.objects.create(**validated_data)
        PatientAddress.objects.create(patient=patient, **address_data)
        return patient

    def update(self, instance, validated_data):
        address_data = validated_data.pop('address', None)

        dob = validated_data.get('dob')
        if dob:
            validated_data['age'] = self.calculate_age_from_dob(dob)  # 🔑 Auto calculate during update too

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
from django.contrib.auth.hashers import check_password
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        try:
            user = AppUser.objects.get(username=data['username'])
        except AppUser.DoesNotExist:
            raise serializers.ValidationError("Invalid username or password")

        if not check_password(data['password'], user.password):
            raise serializers.ValidationError("Invalid username or password")

        return {
            'id': user.id,
            'username': user.username,
            'role': user.role,
        }


from .models import AppUser
from django.contrib.auth.hashers import make_password


class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppUser
        fields = ['username', 'password', 'role']

    def create(self, validated_data):
        validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)


class PasswordChangeSerializer(serializers.Serializer):
    username = serializers.CharField()
    new_password = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        if not AppUser.objects.filter(username=username).exists():
            raise serializers.ValidationError("User does not exist.")
        return data

    def save(self):
        username = self.validated_data['username']
        new_password = make_password(self.validated_data['new_password'])
        user = AppUser.objects.get(username=username)
        user.password = new_password
        user.save()
        return user

