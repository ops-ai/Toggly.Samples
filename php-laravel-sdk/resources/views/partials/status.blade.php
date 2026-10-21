{{-- Three states distinguish a verified OFF result from an initial load failure. --}}
<span
    class="flag-state {{ $enabled === null ? 'unknown' : ($enabled ? 'on' : 'off') }}"
    data-toggly-state="{{ $enabled ? 'on' : 'off' }}"
>
    {{ $enabled === null ? 'UNKNOWN' : ($enabled ? 'ON' : 'OFF') }}
</span>
