#!/usr/bin/env python
"""Django management entry point. Ordinary maintenance must not contact Toggly."""
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    # Django calls AppConfig.ready even for migrate/check/collectstatic. Avoid a
    # network client and worker threads in those short-lived maintenance commands.
    if len(sys.argv) < 2 or sys.argv[1] not in {'runserver', 'test'}:
        os.environ['SAMPLE_MANAGEMENT'] = '1'
    from django.core.management import execute_from_command_line
    try:
        execute_from_command_line(sys.argv)
    finally:
        from showcase.apps import close_client
        close_client()
