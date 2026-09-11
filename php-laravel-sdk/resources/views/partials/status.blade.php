{{-- Three states distinguish a verified OFF result from an initial load failure. --}}
<span class="flag-state {{ $enabled === null ? 'unknown' : ($enabled ? 'on' : 'off') }}">
    {{ $enabled === null ? 'UNKNOWN' : ($enabled ? 'ON' : 'OFF') }}
</span>
