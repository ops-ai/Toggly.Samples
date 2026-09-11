"""Explicit no-key demo fixture using real SDK models and public snapshot API.

This is NOT a downloaded dashboard definition or proof of a live integration.
The SDK evaluates every rule; this module never calculates an ON/OFF result.
"""
from toggly import TogglyClient, TogglyConfig
from toggly.models import FeatureDefinition, FeatureFilter
from toggly.providers import DefinitionsSnapshot, MemorySnapshotProvider
from .catalog import FILTERS, ORDER_RULE

def definitions():
    rows = [FeatureDefinition(key, [FeatureFilter('AlwaysOn' if on else 'AlwaysOff')])
            for key, on in [('new-dashboard', True), ('api-v2', False),
                            ('enhanced-submit', True), ('beta-access', True)]]
    rows.append(FeatureDefinition('ExpressCheckout', [FeatureFilter('ContextProperty', ORDER_RULE)], context_kind='Order'))
    rows.extend(FeatureDefinition(key, [FeatureFilter(alias, params)], context_kind='Order' if alias == 'ContextProperty' else None)
                for key, alias, params, _ in FILTERS)
    return rows

def create_offline_client():
    snapshot = MemorySnapshotProvider()
    snapshot.save_definitions(DefinitionsSnapshot(definitions=definitions()))
    client = TogglyClient(TogglyConfig(snapshot_provider=snapshot,
        refresh_interval=0, disable_background_refresh=True, enable_live_updates=False,
        enable_usage_tracking=False, register_contexts_on_startup=False))
    client.init()
    return client
