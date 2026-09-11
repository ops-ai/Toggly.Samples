from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # The adapter uses str(user.pk), not username. A string key makes the shared
    # alice/bob recipe exact while retaining real Django authentication/sessions.
    id = None
    username = models.CharField(max_length=150, primary_key=True)
