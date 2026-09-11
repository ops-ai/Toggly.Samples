from django.core.management.base import BaseCommand
from showcase.models import User

class Command(BaseCommand):
    help = 'Create the two local demonstration personas (no passwords).'
    def handle(self, *args, **options):
        for name, staff in [('alice', True), ('bob', False)]:
            user, _ = User.objects.get_or_create(username=name)
            user.is_staff = staff
            user.set_unusable_password()
            user.save()
        self.stdout.write('Created/updated alice and bob demonstration personas.')
