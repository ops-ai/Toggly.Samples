"""Test-only throwing view; never registered in application URL configuration."""
from django.urls import path
from config.urls import urlpatterns as sample_urls

def fail_after_evaluation(request):
    request.toggly.is_enabled('ExpressCheckout')
    raise RuntimeError('Intentional test-only failure after native evaluation')

urlpatterns = [path('test-error/', fail_after_evaluation), *sample_urls]
