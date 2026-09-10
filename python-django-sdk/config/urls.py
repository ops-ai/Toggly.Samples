from django.urls import path
from toggly_django.decorators import feature_flag_switch
from showcase import views

urlpatterns = [
    path('', views.home, name='home'), path('gates/', views.gates, name='gates'),
    path('programmatic/', views.programmatic, name='programmatic'),
    path('identity/', views.identity, name='identity'), path('orders/', views.orders, name='orders'),
    path('filters/', views.filters, name='filters'), path('integrations/', views.integrations, name='integrations'),
    path('api/snapshot/', views.api_snapshot), path('submit/', views.submit),
    path('refresh/', views.refresh), path('variant/', views.variant),
    path('native/targeted/', views.targeted), path('native/all/', views.all_gate),
    path('native/any/', views.any_gate), path('native/negated/', views.negated_gate),
    path('native/redirect/', views.redirect_gate), path('native/beta/', views.beta),
    path('native/switch/', feature_flag_switch('api-v2', views.api_v2, views.api_v1)),
]
