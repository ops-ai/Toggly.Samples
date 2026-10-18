"""Labeled offline data using the public snapshot API and real SDK evaluator."""
from toggly import TogglyClient, TogglyConfig
from toggly.models import (
    Allocation, FeatureDefinition, FeatureFilter, UserAllocation, Variant,
)
from toggly.providers import DefinitionsSnapshot, MemorySnapshotProvider
from .catalog import FILTERS, ORDER_RULE


DASHBOARD_VARIANTS = [
    Variant('compact', {'value': {'density': 'compact'}}),
    Variant('classic', {'value': {'density': 'classic'}}),
]
DASHBOARD_ALLOCATION = Allocation(
    default_when_enabled='classic',
    default_when_disabled='classic',
    user=[UserAllocation(variant='compact', users=['alice'])],
)


def definitions():
    rows = []
    for key, enabled in [
        ('new-dashboard', True),
        ('api-v2', False),
        ('enhanced-submit', True),
        ('beta-access', True),
    ]:
        if key == 'new-dashboard':
            rows.append(FeatureDefinition(
                key, [FeatureFilter('AlwaysOn' if enabled else 'AlwaysOff')],
                variants=DASHBOARD_VARIANTS, allocation=DASHBOARD_ALLOCATION,
            ))
        else:
            rows.append(FeatureDefinition(
                key, [FeatureFilter('AlwaysOn' if enabled else 'AlwaysOff')],
            ))
    rows.append(FeatureDefinition(
        'ExpressCheckout', [FeatureFilter('ContextProperty', ORDER_RULE)],
        context_kind='Order',
    ))
    for key, alias, params, _ in FILTERS:
        rows.append(FeatureDefinition(
            key, [FeatureFilter(alias, params)],
            context_kind='Order' if alias == 'ContextProperty' else None,
        ))
    return rows


def create_offline_client():
    snapshot = MemorySnapshotProvider()
    snapshot.save_definitions(DefinitionsSnapshot(definitions=definitions()))
    # There is deliberately no app key or external traffic in this mode.
    # The fixture defines rules, never evaluates or substitutes their outcomes.
    client = TogglyClient(TogglyConfig(
        snapshot_provider=snapshot,
        disable_background_refresh=True,
        enable_live_updates=False,
        enable_usage_tracking=False,
        enable_metrics=False,
        register_contexts_on_startup=False,
    ))
    client.init()
    return client
