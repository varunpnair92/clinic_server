from django.contrib import admin

from .models import AppUser

@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'role')  # Display these columns
    search_fields = ('username', 'role')       # Add search by these fields

