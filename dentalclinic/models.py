from django.db import models

class Patient(models.Model):
    name = models.CharField(max_length=100)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=10)
    phone = models.CharField(max_length=15)

    class Meta:
        unique_together = ['name', 'phone']  # ✅ Enforces unique name + phone

    def __str__(self):
        return f"{self.name} ({self.phone})"


class PatientAddress(models.Model):
    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name='address')
    address = models.CharField(max_length=255)

    def __str__(self):
        return f"Address of {self.patient.name}"


class VisitHistory(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='visits')
    visit_date = models.DateTimeField(auto_now_add=True)
    reason = models.TextField()

    def __str__(self):
        return f"Visit on {self.visit_date.date()} - {self.patient.name}"


class Prescription(models.Model):
    visit = models.ForeignKey(VisitHistory, on_delete=models.CASCADE, related_name='prescriptions')
    medicine_name = models.CharField(max_length=255)
    instructions = models.TextField()

    def __str__(self):
        return f"{self.medicine_name} for visit {self.visit_id}"


class TransactionHistory(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='transactions')
    visit = models.ForeignKey(VisitHistory, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)
    transaction_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"₹{self.amount} for {self.patient.name}"
