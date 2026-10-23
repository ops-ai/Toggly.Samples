{{-- Three states distinguish a verified OFF result from an initial load failure. --}}
<span
    class="flag-state {{ $enabled === null ? 'unknown' : ($enabled ? 'on' : 'off') }}"
    @if($enabled !== null) data-toggly-state="{{ $enabled ? 'on' : 'off' }}" @endif
>
    {{ $enabled === null ? 'UNKNOWN' : ($enabled ? 'ON' : 'OFF') }}
</span>
